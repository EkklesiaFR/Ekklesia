import { createHash } from 'crypto';

export type RankingRow = {
  projectId: string;
  title: string;
  score: number;
};

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
    v: 1,
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

  return createHash('sha256').update(canonical).digest('hex');
}