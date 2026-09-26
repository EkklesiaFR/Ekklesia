import { expect, it } from 'vitest';
import { decideVote } from './vote-decision';
import { computeSchulzeOutcome } from './tally';

it('applies exact quorum, with no official winner below threshold or without ballots', () => {
  expect(decideVote(119, 200, 60, ['A'])).toMatchObject({ decisionStatus: 'quorum-not-met', adopted: false, winnerId: null });
  expect(decideVote(120, 200, 60, ['A'])).toMatchObject({ decisionStatus: 'adopted', adopted: true, winnerId: 'A' });
  expect(decideVote(0, 200, 0, [])).toMatchObject({ decisionStatus: 'no-ballots', adopted: false, winnerId: null });
  expect(() => decideVote(0, 0, 0, [])).toThrow('Invalid electorate');
});

it('keeps all Schulze maxima and equal ranks in a perfect cycle', () => {
  const tally = computeSchulzeOutcome(['C', 'A', 'B'], ['ABC', 'BCA', 'CAB'].map(s => ({ ranking: [...s] })));
  expect(tally.winnerIds).toEqual(['A', 'B', 'C']);
  expect(tally.ranking.map(r => r.rank)).toEqual([1, 1, 1]);
  expect(decideVote(3, 3, 100, tally.winnerIds)).toMatchObject({
    decisionStatus: 'tie', winnerId: null, adopted: false, tiedWinnerIds: ['A', 'B', 'C'],
  });
});

it('keeps a clear winner and tied lower ranks without inventing a top tie', () => {
  const tally = computeSchulzeOutcome(['A', 'B', 'C'], [{ ranking: ['A'] }]);
  expect(tally.winnerIds).toEqual(['A']);
  expect(tally.ranking.map(r => r.rank)).toEqual([1, 2, 2]);
});
