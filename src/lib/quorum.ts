/** Exact threshold shared by displays and the versioned adoption decision. */
export function quorumReached(ballots: number, eligible: number | null | undefined, pct: number): boolean | null {
  if (!Number.isFinite(pct) || pct < 0 || pct > 100 || !Number.isSafeInteger(ballots) || ballots < 0) return null;
  if (pct === 0) return true;
  if (typeof eligible !== 'number' || !Number.isSafeInteger(eligible) || eligible <= 0) return null;
  return ballots * 100 >= eligible * pct;
}
