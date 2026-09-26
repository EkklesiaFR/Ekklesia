import { expect, it } from 'vitest';
import { buildPairwisePreferences, computeSchulzeResults } from './tally';

it('matches the independently tabulated 45-voter Schulze example (E > A > C > B > D)', () => {
  // Schulze's worked example: 5 ACBED, 5 ADECB, 8 BEDAC, 3 CABED,
  // 7 CAEBD, 2 CBADE, 7 DCEBA, 8 EBADC. Pairwise totals transcribed independently.
  const groups: [number, string][] = [[5, 'ACBED'], [5, 'ADECB'], [8, 'BEDAC'],
    [3, 'CABED'], [7, 'CAEBD'], [2, 'CBADE'], [7, 'DCEBA'], [8, 'EBADC']];
  const ballots = groups.flatMap(([count, order]) => Array.from({ length: count }, () => ({ ranking: [...order] })));
  expect(buildPairwisePreferences([... 'ABCDE'], ballots)).toEqual([
    [0, 20, 26, 30, 22], [25, 0, 16, 33, 18], [19, 29, 0, 17, 24],
    [15, 12, 28, 0, 14], [23, 27, 21, 31, 0],
  ]);
  const result = computeSchulzeResults([... 'ABCDE'], ballots);
  expect(result.total).toBe(45);
  expect(result.ranking.map(r => r.id)).toEqual([... 'EACBD']);
});

it('resolves an asymmetric majority cycle through strongest paths', () => {
  // Direct majorities A>B=5, B>C=5, C>A=4. A>C via B has strength 5,
  // B>A via C has strength 4, C>B via A has strength 4: A > B > C.
  const ballots = ['ABC', 'ABC', 'ABC', 'BCA', 'BCA', 'CAB', 'CAB'].map(s => ({ ranking: [...s] }));
  expect(buildPairwisePreferences(['A', 'B', 'C'], ballots)).toEqual([[0, 5, 3], [2, 0, 5], [4, 2, 0]]);
  expect(computeSchulzeResults(['C', 'B', 'A'], ballots).ranking).toEqual([
    { id: 'A', rank: 1, score: 2 }, { id: 'B', rank: 2, score: 1 }, { id: 'C', rank: 3, score: 0 },
  ]);
});

it('documents that an exact tie uses the existing identifier tie-break, not an electoral majority', () => {
  const result = computeSchulzeResults(['B', 'A'], [{ ranking: ['A', 'B'] }, { ranking: ['B', 'A'] }]);
  expect(result.ranking).toEqual([{ id: 'A', rank: 1, score: 0 }, { id: 'B', rank: 2, score: 0 }]);
});
