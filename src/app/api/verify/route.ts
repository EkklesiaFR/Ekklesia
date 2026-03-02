import { NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase/admin';
import { computeFinalSeal } from '@/lib/pv/seal';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);

  const voteId = searchParams.get('voteId');
  const assemblyId = searchParams.get('assemblyId');
  const providedSeal = searchParams.get('seal');

  if (!voteId || !assemblyId || !providedSeal) {
    return NextResponse.json({ ok: false, error: 'Missing parameters' }, { status: 400 });
  }

  const db = getAdminDb();
  const snap = await db.doc(`assemblies/${assemblyId}/votes/${voteId}`).get();

  if (!snap.exists) {
    return NextResponse.json({ ok: false, error: 'Vote not found' }, { status: 404 });
  }

  const voteData = snap.data();
  const results = voteData?.results;

  if (!results?.winnerId || !results?.fullRanking) {
    return NextResponse.json({ ok: false, error: 'Vote not finalized' }, { status: 400 });
  }

  const lockedAtISO = (voteData.lockedAt?.toDate?.() ?? new Date()).toISOString();

  const expectedSeal = computeFinalSeal({
    voteId,
    method: results.method,
    lockedAtISO,
    ballotsCount: results.totalBallots ?? results.total ?? 0,
    participationPct: voteData.eligibleCountAtOpen
      ? Math.round((100 * (results.totalBallots ?? 0)) / voteData.eligibleCountAtOpen)
      : null,
    winnerId: results.winnerId,
    ranking: results.fullRanking.map((r: any) => ({
      projectId: r.id ?? r.projectId,
      title: r.title,
      score: r.score ?? r.rank,
    })),
  });

  return NextResponse.json({
    ok: expectedSeal === providedSeal,
    expectedSeal,
    providedSeal,
    voteId,
    assemblyId,
  });
}