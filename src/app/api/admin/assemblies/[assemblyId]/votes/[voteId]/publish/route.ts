import { NextResponse } from 'next/server';
import crypto from 'crypto';

import { getAdminApp, getAdminDb } from '@/lib/firebase/admin';
import { sendVoteLockedNotifications } from '@/lib/server/notifications';
import { computeSchulzeResults } from '@/lib/tally';

export const runtime = 'nodejs';

type RouteParams = { assemblyId: string; voteId: string };

function sha256Hex(input: string): string {
  return crypto.createHash('sha256').update(input, 'utf8').digest('hex');
}

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
    const publicResultRef = assemblyRef.collection('public').doc('lastResult');

    // 1) Read vote
    const voteSnap = await voteRef.get();
    if (!voteSnap.exists) {
      return NextResponse.json({ error: 'Vote not found' }, { status: 404 });
    }

    const vote = voteSnap.data() as {
      state?: string;
      projectIds?: string[];
      title?: string;
      question?: string;
      results?: unknown;
    };

    // Idempotence
    if (vote.state === 'locked') {
      return NextResponse.json(
        { ok: true, alreadyLocked: true, results: vote.results ?? null },
        { status: 200 }
      );
    }

    if (vote.state !== 'open') {
      return NextResponse.json({ error: 'Vote is not open' }, { status: 409 });
    }

    const projectIds = Array.isArray(vote.projectIds) ? vote.projectIds : [];
    if (projectIds.length === 0) {
      return NextResponse.json({ error: 'No projects on vote' }, { status: 400 });
    }

    // 2) Read ballots
    const ballotsSnap = await voteRef.collection('ballots').get();
    const rawBallots = ballotsSnap.docs.map((doc) => doc.data() as { ranking?: unknown });

    // Normalize ballots
    const ballots = rawBallots
      .map((b) => ({
        ranking: Array.isArray(b.ranking) ? (b.ranking as string[]) : [],
      }))
      .filter((b) => b.ranking.length > 0);

    if (ballots.length === 0) {
      return NextResponse.json({ error: 'No ballots' }, { status: 400 });
    }

    // 3) Compute Schulze
    const results = computeSchulzeResults(projectIds, ballots);

    // 4) Hash canonical payload
    const canonicalForHash = {
      method: 'schulze',
      voteId,
      projectIds,
      total: ballots.length,
      winnerId: results.winnerId,
      fullRanking: results.ranking,
    };
    const resultsHash = sha256Hex(JSON.stringify(canonicalForHash));

    const now = new Date();

    const resultsData = {
      method: 'schulze' as const,
      computedBy: auth.uid,
      resultsHash,
      winnerId: results.winnerId,
      fullRanking: results.ranking,
      computedAt: now,
      total: ballots.length,
    };

    // 5) winner label (best effort)
    let winnerLabel = 'Vainqueur';
    try {
      if (results.winnerId) {
        const projSnap = await db.collection('projects').doc(String(results.winnerId)).get();
        const title = (projSnap.data() as { title?: unknown } | undefined)?.title;
        if (typeof title === 'string' && title.trim()) {
          winnerLabel = title.trim();
        }
      }
    } catch {
      // ignore
    }

    // 6) Write updates
    const batch = db.batch();

    batch.update(voteRef, {
      state: 'locked',
      results: resultsData,
      lockedAt: now,
      lockedBy: auth.uid,
      updatedAt: now,
    });

    batch.update(assemblyRef, {
      state: 'locked',
      activeVoteId: null,
      updatedAt: now,
    });

    batch.set(
      publicResultRef,
      {
        ...resultsData,
        voteId,
        voteTitle: vote.title ?? vote.question ?? '',
        closedAt: now,
        lockedAt: now,
        winnerLabel,
      },
      { merge: true }
    );

    await batch.commit();

    // 7) Send notifications (non bloquant)
    try {
      await sendVoteLockedNotifications({
        assemblyId,
        voteId,
        voteTitle: vote.title ?? vote.question,
      });
    } catch (err) {
      console.error('[NOTIFICATIONS] vote_locked failed', err);
    }

    return NextResponse.json(
      { ok: true, alreadyLocked: false, results: resultsData },
      { status: 200 }
    );
  } catch (e) {
    console.error('[PUBLISH] error', e);
    return NextResponse.json({ error: 'Publish failed' }, { status: 500 });
  }
}