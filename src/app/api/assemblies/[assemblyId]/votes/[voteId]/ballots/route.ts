import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import { getAuth, type DecodedIdToken } from 'firebase-admin/auth';
import { FieldValue, type Transaction } from 'firebase-admin/firestore';
import { getAdminApp, getAdminDb } from '@/lib/firebase/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface BallotRequestBody {
  ranking: string[];
}

function getBearerToken(req: NextRequest): string | null {
  const authHeader = req.headers.get('authorization') || req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;
  const token = authHeader.slice('Bearer '.length).trim();
  return token.length ? token : null;
}

type RouteContext = {
  params: Promise<{
    assemblyId: string;
    voteId: string;
  }>;
};

export async function POST(req: NextRequest, context: RouteContext) {
  try {
    const { assemblyId, voteId } = await context.params;

    if (!assemblyId || !voteId) {
      return NextResponse.json({ error: 'Missing assemblyId or voteId' }, { status: 400 });
    }

    // --- AUTH (cookie __session OR Bearer ID token) ---
    const auth = getAuth(getAdminApp());

    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('__session')?.value || null;
    const bearer = getBearerToken(req);

    let decodedToken: DecodedIdToken;

    if (sessionCookie) {
      decodedToken = await auth.verifySessionCookie(sessionCookie, true);
    } else if (bearer) {
      decodedToken = await auth.verifyIdToken(bearer);
    } else {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = (await req.json()) as BallotRequestBody;
    if (!body || !Array.isArray(body.ranking) || body.ranking.length === 0) {
      return NextResponse.json({ error: 'Invalid ballot data' }, { status: 400 });
    }

    // --- REFS ---
    const db = getAdminDb();
    const voteRef = db.doc(`assemblies/${assemblyId}/votes/${voteId}`);
    const ballotsCol = voteRef.collection('ballots');
    const ballotRef = ballotsCol.doc(decodedToken.uid);

    // ✅ Backfill base count (Admin SDK aggregation)
    const countSnap = await ballotsCol.count().get();
    const baseCount = countSnap.data().count ?? 0;

    await db.runTransaction(async (tx: Transaction) => {
      const [voteSnap, ballotSnap] = await Promise.all([tx.get(voteRef), tx.get(ballotRef)]);

      const currentBallotCount = voteSnap.exists ? (voteSnap.data() as any)?.ballotCount : undefined;

      // ✅ Initialize ballotCount once if missing/null (so members can read it)
      if (currentBallotCount === undefined || currentBallotCount === null) {
        tx.set(voteRef, { ballotCount: baseCount }, { merge: true });
      }

      // ✅ increment only on first vote for this user
      if (!ballotSnap.exists) {
        tx.set(
          voteRef,
          { ballotCount: FieldValue.increment(1) },
          { merge: true }
        );
      }

      tx.set(
        ballotRef,
        {
          ranking: body.ranking,
          updatedAt: FieldValue.serverTimestamp(),
          ...(ballotSnap.exists ? {} : { castAt: FieldValue.serverTimestamp() }),
        },
        { merge: true }
      );
    });

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error: any) {
    console.error('Submit ballot error:', error);

    const code = error?.code || error?.errorInfo?.code;

    if (
      code === 'auth/session-cookie-expired' ||
      code === 'auth/id-token-expired' ||
      code === 'auth/argument-error'
    ) {
      return NextResponse.json({ error: 'Session expired' }, { status: 401 });
    }

    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}