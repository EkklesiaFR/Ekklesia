import { NextResponse } from 'next/server';

import { getAdminApp, getAdminDb } from '@/lib/firebase/admin';
import { sendVoteCreatedNotifications } from '@/lib/server/notifications';

export const runtime = 'nodejs';

type RouteParams = { assemblyId: string; voteId: string };

function getBearerToken(req: Request): string | null {
  const header = req.headers.get('authorization') || '';
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match?.[1] ?? null;
}

async function requireAdminActive(
  req: Request
): Promise<{ ok: true; uid: string } | { ok: false; status: number }> {
  const token = getBearerToken(req);
  if (!token) return { ok: false, status: 401 };

  const decoded = await getAdminApp().auth().verifyIdToken(token);
  const db = getAdminDb();

  const memberSnap = await db.collection('members').doc(decoded.uid).get();
  const member = memberSnap.data() as { role?: string; status?: string } | undefined;

  if (!member || member.role !== 'admin' || member.status !== 'active') {
    return { ok: false, status: 403 };
  }

  return { ok: true, uid: decoded.uid };
}

export async function POST(
  req: Request,
  { params }: { params: Promise<RouteParams> }
) {
  try {
    const auth = await requireAdminActive(req);
    if (!auth.ok) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: auth.status });
    }

    const { assemblyId, voteId } = await params;
    const db = getAdminDb();

    const assemblyRef = db.collection('assemblies').doc(assemblyId);
    const voteRef = assemblyRef.collection('votes').doc(voteId);

    const [voteSnap, eligibleSnap] = await Promise.all([
      voteRef.get(),
      db.collection('members').where('status', '==', 'active').count().get(),
    ]);

    if (!voteSnap.exists) {
      return NextResponse.json({ error: 'Vote not found' }, { status: 404 });
    }

    const vote = voteSnap.data() as {
      state?: string;
      question?: string;
      title?: string;
    };

    if (vote.state === 'open') {
      return NextResponse.json({ ok: true, alreadyOpen: true }, { status: 200 });
    }

    if (vote.state === 'locked') {
      return NextResponse.json(
        { error: 'Locked vote cannot be reopened' },
        { status: 409 }
      );
    }

    if (vote.state !== 'draft') {
      return NextResponse.json(
        { error: 'Only draft votes can be opened' },
        { status: 409 }
      );
    }

    const eligibleCountAtOpen = eligibleSnap.data().count ?? 0;
    const now = new Date();

    const batch = db.batch();

    batch.update(voteRef, {
      state: 'open',
      eligibleCountAtOpen,
      openedAt: now,
      openedBy: auth.uid,
      updatedAt: now,
    });

    batch.update(assemblyRef, {
      state: 'open',
      activeVoteId: voteId,
      updatedAt: now,
    });

    await batch.commit();

    try {
      await sendVoteCreatedNotifications({
        assemblyId,
        voteId,
        voteTitle: vote.question ?? vote.title,
      });
    } catch (err) {
      console.error('[NOTIFICATIONS] vote_created failed', err);
    }

    return NextResponse.json(
      {
        ok: true,
        alreadyOpen: false,
        eligibleCountAtOpen,
      },
      { status: 200 }
    );
  } catch (e) {
    console.error('[OPEN_VOTE] error', e);
    return NextResponse.json({ error: 'Open vote failed' }, { status: 500 });
  }
}