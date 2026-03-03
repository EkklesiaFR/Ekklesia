import 'server-only';
import { createHmac } from 'crypto';

export type RankingRow = {
  projectId: string;
  title: string;
  score: number;
};

function requirePvSalt(): string {
  const salt = process.env.PV_SALT;
  if (!salt) {
    throw new Error('PV_SALT is not configured (Secret Manager).');
  }
  return salt;
}

export function computeFinalSeal(input: {
  voteId: string;
  method: string;
  lockedAtISO: string;
  ballotsCount: number;
  participationPct?: number | null;
  winnerId: string;
  ranking: RankingRow[];
}) {
  const canonical = JSON.stringify({
    v: 2, // version du seal (important)
    voteId: input.voteId,
    method: input.method,
    lockedAt: input.lockedAtISO,
    ballotsCount: input.ballotsCount,
    participationPct: input.participationPct ?? null,
    winnerId: input.winnerId,
    ranking: input.ranking.map((r) => ({
      projectId: r.projectId,
      title: r.title,
      score: r.score,
    })),
  });

  const key = requirePvSalt();

  return createHmac('sha256', key)
    .update(canonical)
    .digest('hex');
}