import 'server-only';
import { createHmac } from 'crypto';

export type RankingRow = {
  projectId: string;
  title: string;
  score: number;
};

/**
 * v0.4.3: Versioned and strictly sorted canonical stringify to ensure 
 * seal identity between client and server environments.
 */
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
  // Sort ranking by projectId to ensure determinism in array order
  const sortedRanking = [...input.ranking]
    .sort((a, b) => a.projectId.localeCompare(b.projectId))
    .map((r) => ({
      projectId: r.projectId,
      score: r.score,
      title: r.title,
    }));

  // Canonical payload with strictly ordered keys (v2)
  const canonical = JSON.stringify({
    ballotsCount: input.ballotsCount,
    lockedAt: input.lockedAtISO,
    method: input.method,
    participationPct: input.participationPct ?? null,
    ranking: sortedRanking,
    v: 2,
    voteId: input.voteId,
    winnerId: input.winnerId,
  });

  const key = requirePvSalt();

  return createHmac('sha256', key)
    .update(canonical)
    .digest('hex');
}
