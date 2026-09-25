import { expect, it } from 'vitest';
import { quorumReached } from './quorum';

it('does not turn rounded participation into a quorum majority', () => {
  expect(quorumReached(119, 200, 60)).toBe(false);
  expect(quorumReached(120, 200, 60)).toBe(true);
  expect(quorumReached(0, 200, 60)).toBe(false);
  expect(quorumReached(0, undefined, 60)).toBeNull();
  expect(quorumReached(1, 0, 60)).toBeNull();
  expect(quorumReached(0, undefined, 0)).toBe(true);
});
