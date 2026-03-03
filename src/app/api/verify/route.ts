import { NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase/admin';
import { computeFinalSeal } from '@/lib/pv/seal';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type VerifyOk = {
  ok: true;
  match: boolean;
  voteId: string;
  assemblyId: string;
  expectedSeal?: string;
  providedSeal: string;
};

type VerifyErr = { ok: false; error: string };

function json(data: VerifyOk | VerifyErr, status = 200) {
  return NextResponse.json(data, { status });
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);

    const voteId = searchParams.get('voteId')?.trim();
    const assemblyId = searchParams.get('assemblyId')?.trim();
    const providedSeal = searchParams.get('seal')?.trim();

    if (!voteId || !assemblyId || !providedSeal) {
      return json({ ok: false, error: 'Missing parameters (voteId, assemblyId, seal).' }, 400);
    }

    const db = getAdminDb();
    const snap = await db.doc(`assemblies/${assemblyId}/votes/${voteId}`).get();

    if (!snap.exists) return json({ ok: false, error: 'Vote not found.' }, 404);

    const voteData = snap.data();
    if (!voteData) return json({ ok: false, error: 'Vote data empty.' }, 404);

    const results = voteData.results;
    if (!results?.winnerId || !Array.isArray(results.fullRanking) || results.fullRanking.length === 0) {
      return json({ ok: false, error: 'Vote not finalized.' }, 400);
    }

    const lockedAtISO = (voteData.lockedAt?.toDate?.() ?? new Date()).toISOString();
    const ballotsCount = Number(results.totalBallots ?? results.total ?? 0) || 0;

    const eligible = Number(voteData.eligibleCountAtOpen ?? 0) || 0;
    const participationPct = eligible > 0 ? Math.round((100 * ballotsCount) / eligible) : null;

    const expectedSeal = computeFinalSeal({
      voteId,
      method: String(results.method ?? 'schulze'),
      lockedAtISO,
      ballotsCount,
      participationPct,
      winnerId: String(results.winnerId),
      ranking: results.fullRanking.map((r: any) => ({
        projectId: String(r?.id ?? r?.projectId ?? ''),
        title: String(r?.title ?? ''),
        score: Number(r?.score ?? r?.rank ?? 0) || 0,
      })),
    });

    return json({
      ok: true,
      match: expectedSeal === providedSeal,
      voteId,
      assemblyId,
      expectedSeal, // tu peux le retirer plus tard si tu veux
      providedSeal,
    });
  } catch (e: any) {
    return json({ ok: false, error: e?.message ? String(e.message) : 'Unknown server error.' }, 500);
  }
}