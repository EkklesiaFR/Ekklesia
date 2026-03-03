import { NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase/admin';
import { computeFinalSeal, type RankingRow } from '@/lib/pv/seal';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type VerifyOk = {
  ok: true;
  match: boolean;
  voteId: string;
  assemblyId: string;
  expectedSeal?: string;
  providedSeal: string;
  debug?: {
    method: string;
    lockedAtISO: string;
    ballotsCount: number;
    participationPct: number | null;
    winnerId: string;
    rankingLen: number;
  };
};

type VerifyErr = { ok: false; error: string };

function json(data: VerifyOk | VerifyErr, status = 200) {
  return NextResponse.json(data, { status });
}

function tsToDate(ts: any): Date | null {
  if (!ts) return null;
  if (ts?.toDate) return ts.toDate();
  const d = new Date(ts);
  return Number.isNaN(d.getTime()) ? null : d;
}

function normalizeMethod(input: any) {
  const s = String(input ?? '').trim();
  return s ? s.toLowerCase() : 'schulze';
}

function pickLockedAtISO(voteData: any): string {
  const lockedAt = tsToDate(voteData?.lockedAt);
  const computedAt = tsToDate(voteData?.results?.computedAt);
  const d = lockedAt ?? computedAt ?? new Date();
  return d.toISOString();
}

/**
 * ✅ Canonical payload: MUST MATCH pdf route.
 */
function buildSealPayload(voteId: string, voteData: any) {
  const results = voteData?.results ?? {};
  const method = normalizeMethod(results?.method ?? voteData?.method ?? 'schulze');

  const lockedAtISO = pickLockedAtISO(voteData);

  const ballotsCount =
    Number(results?.totalBallots ?? results?.total ?? results?.totalVotes ?? voteData?.ballotsCount ?? 0) || 0;

  const eligible = Number(voteData?.eligibleCountAtOpen ?? voteData?.eligibleCount ?? 0) || 0;
  const participationPct = eligible > 0 ? Math.round((100 * ballotsCount) / eligible) : null;

  const winnerId = results?.winnerId ? String(results.winnerId) : null;

  const fullRanking = Array.isArray(results?.fullRanking) ? results.fullRanking : [];
  const ranking: RankingRow[] = fullRanking.map((r: any) => {
    const projectId = String(r?.id ?? r?.projectId ?? '').trim();
    const titleRaw = String(r?.title ?? r?.name ?? '').trim();
    return {
      projectId,
      title: titleRaw || projectId,
      score: Number(r?.score ?? r?.rank ?? 0) || 0,
    };
  });

  return { method, lockedAtISO, ballotsCount, participationPct, winnerId, ranking };
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

    const payload = buildSealPayload(voteId, voteData);

    if (!payload.winnerId || payload.ranking.length === 0) {
      return json({ ok: false, error: 'Vote not finalized.' }, 400);
    }

    const expectedSeal = computeFinalSeal({
      voteId,
      method: payload.method,
      lockedAtISO: payload.lockedAtISO,
      ballotsCount: payload.ballotsCount,
      participationPct: payload.participationPct,
      winnerId: payload.winnerId,
      ranking: payload.ranking,
    });

    return json({
      ok: true,
      match: expectedSeal === providedSeal,
      voteId,
      assemblyId,
      expectedSeal,
      providedSeal,
      debug: {
        method: payload.method,
        lockedAtISO: payload.lockedAtISO,
        ballotsCount: payload.ballotsCount,
        participationPct: payload.participationPct,
        winnerId: payload.winnerId,
        rankingLen: payload.ranking.length,
      },
    });
  } catch (e: any) {
    return json({ ok: false, error: e?.message ? String(e.message) : 'Unknown server error.' }, 500);
  }
}