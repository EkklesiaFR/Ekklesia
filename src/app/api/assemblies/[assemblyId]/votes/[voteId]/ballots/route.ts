import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getAuth, type DecodedIdToken } from 'firebase-admin/auth';
import { FieldValue, type Transaction } from 'firebase-admin/firestore';
import { getAdminApp, getAdminDb } from '@/lib/firebase/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface BallotRequestBody {
  ranking: string[];
}

function getBearerToken(req: Request): string | null {
  const authHeader = req.headers.get('authorization') || req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;
  const token = authHeader.slice('Bearer '.length).trim();
  return token.length ? token : null;
}

function uniqueNonEmptyStrings(input: unknown): string[] | null {
  if (!Array.isArray(input)) return null;
  const arr = input.filter((x) => typeof x === 'string' && x.trim().length > 0) as string[];
  const uniq = Array.from(new Set(arr));
  if (uniq.length !== arr.length) return null; // duplicates
  return uniq;
}

export async function POST(
  req: Request,
  { params }: { params: { assemblyId: string; voteId: string } }
) {
  try {
    const { assemblyId, voteId } = params;
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

    // --- BODY ---
    const body = (await req.json()) as BallotRequestBody;
    const ranking = uniqueNonEmptyStrings(body?.ranking);
    if (!ranking || ranking.length === 0) {
      return NextResponse.json({ error: 'Invalid ballot data' }, { status: 400 });
    }

    // --- REFS ---
    const db = getAdminDb();
    const voteRef = db.doc(`assemblies/${assemblyId}/votes/${voteId}`);
    const ballotsCol = voteRef.collection('ballots');
    const ballotRef = ballotsCol.doc(decodedToken.uid);

    // ✅ Backfill base count (Admin SDK aggregation) — outside transaction ok
    // (Used only if vote.ballotCount missing/null)
    const countSnap = await ballotsCol.count().get();
    const baseCount = countSnap.data().count ?? 0;

    await db.runTransaction(async (tx: Transaction) => {
      const [voteSnap, ballotSnap] = await Promise.all([tx.get(voteRef), tx.get(ballotRef)]);

      if (!voteSnap.exists) {
        throw Object.assign(new Error('Vote not found'), { code: 'vote/not-found' });
      }

      const voteData = voteSnap.data() as any;

      // ✅ Block voting unless open
      if (voteData?.state !== 'open') {
        throw Object.assign(new Error('Vote is closed'), { code: 'vote/closed' });
      }

      // ✅ Optional: validate ranking against projects list if present on vote doc
      // (If you store vote.projectIds = string[])
      const projectIds = Array.isArray(voteData?.projectIds) ? (voteData.projectIds as string[]) : null;
      if (projectIds && projectIds.length > 0) {
        // must be same length + contain only known ids
        if (ranking.length !== projectIds.length) {
          throw Object.assign(new Error('Invalid ranking length'), { code: 'vote/invalid-ranking' });
        }
        const allowed = new Set(projectIds);
        if (!ranking.every((id) => allowed.has(id))) {
          throw Object.assign(new Error('Invalid ranking ids'), { code: 'vote/invalid-ranking' });
        }
      }

      const currentBallotCount = voteData?.ballotCount;

      // ✅ Initialize ballotCount once if missing/null (so members can read it)
      if (currentBallotCount === undefined || currentBallotCount === null) {
        tx.set(voteRef, { ballotCount: baseCount }, { merge: true });
      }

      // ✅ increment only on first vote for this user
      if (!ballotSnap.exists) {
        tx.update(voteRef, { ballotCount: FieldValue.increment(1) });
      }

      tx.set(
        ballotRef,
        {
          ranking,
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

    // Vote guards
    if (code === 'vote/not-found') {
      return NextResponse.json({ error: 'Vote not found' }, { status: 404 });
    }
    if (code === 'vote/closed') {
      return NextResponse.json({ error: 'Vote is closed' }, { status: 403 });
    }
    if (code === 'vote/invalid-ranking') {
      return NextResponse.json({ error: 'Invalid ranking' }, { status: 400 });
    }

    // Auth guards
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