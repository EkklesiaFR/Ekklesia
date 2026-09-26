import { quorumReached } from './quorum';

export type DecisionStatus = 'adopted' | 'quorum-not-met' | 'no-ballots' | 'tie';
export type Decision = {
  rulesVersion: 1;
  decisionStatus: DecisionStatus;
  adopted: boolean;
  winnerId: string | null;
  tiedWinnerIds: string[];
  quorumReached: boolean;
  eligibleCount: number;
  quorumPct: number;
};

export function decideVote(total: number, eligible: number, pct: number, top: string[]): Decision {
  const reached = quorumReached(total, eligible, pct);
  if (reached === null || eligible <= 0) throw new Error('Invalid electorate or quorum');
  const decisionStatus: DecisionStatus = total === 0 ? 'no-ballots' : !reached ? 'quorum-not-met'
    : top.length !== 1 ? 'tie' : 'adopted';
  return { rulesVersion: 1, decisionStatus, adopted: decisionStatus === 'adopted',
    winnerId: decisionStatus === 'adopted' ? top[0] : null,
    tiedWinnerIds: top.length > 1 ? top : [], quorumReached: reached, eligibleCount: eligible, quorumPct: pct };
}

export function decisionLabel(result?: { decisionStatus?: string; outcome?: string } | null) {
  switch (result?.decisionStatus ?? result?.outcome) {
    case 'adopted': return 'Décision adoptée';
    case 'quorum-not-met': return 'Quorum non atteint — aucune décision adoptée';
    case 'no-ballots': return 'Aucun bulletin — aucune décision adoptée';
    case 'tie': return 'Égalité — aucun vainqueur unique';
    default: return 'Résultat historique — règles antérieures';
  }
}

export function decisionForSeal(result: Decision): Decision {
  return { rulesVersion: 1, decisionStatus: result.decisionStatus, adopted: result.adopted,
    winnerId: result.winnerId, tiedWinnerIds: result.tiedWinnerIds, quorumReached: result.quorumReached,
    eligibleCount: result.eligibleCount, quorumPct: result.quorumPct };
}
