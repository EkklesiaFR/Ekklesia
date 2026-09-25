import { describe, it, expect, beforeAll } from 'vitest';
import { computeFinalSeal } from './seal';
import { decideVote } from '../vote-decision';
import { createHmac } from 'node:crypto';

describe('PV seal (HMAC): computeFinalSeal', () => {
  beforeAll(() => {
    process.env.PV_SALT = 'test_salt_for_ci_only_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
  });

  const base = {
    voteId: 'vote123',
    method: 'schulze',
    lockedAtISO: '2026-03-03T12:00:00.000Z',
    ballotsCount: 10,
    participationPct: 50,
    winnerId: 'p1',
    ranking: [
      { projectId: 'p1', title: 'Project 1', score: 1 },
      { projectId: 'p2', title: 'Project 2', score: 0 },
    ],
  };

  it('is deterministic', () => {
    const a = computeFinalSeal(base as any);
    const b = computeFinalSeal(base as any);
    expect(a).toBe(b);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
  });

  it('changes if ballotsCount changes', () => {
    const a = computeFinalSeal(base as any);
    const b = computeFinalSeal({ ...(base as any), ballotsCount: 11 });
    expect(a).not.toBe(b);
  });

  it('changes if ranking order changes', () => {
    const a = computeFinalSeal(base as any);
    const b = computeFinalSeal({ ...(base as any), ranking: [...base.ranking].reverse() } as any);
    expect(a).not.toBe(b);
  });
  it('preserves the exact historical v2 canonical format', () => {
    const canonical = JSON.stringify({ v: 2, voteId: base.voteId, method: base.method,
      lockedAt: base.lockedAtISO, ballotsCount: base.ballotsCount, participationPct: base.participationPct,
      winnerId: base.winnerId, ranking: base.ranking });
    expect(computeFinalSeal(base)).toBe(createHmac('sha256', process.env.PV_SALT!).update(canonical).digest('hex'));
  });
  it('binds new decisions and their quorum reference, even when no winner is adopted', () => {
    const decision = decideVote(10, 200, 60, ['p1']);
    const input = { ...base, winnerId: null, decision };
    expect(computeFinalSeal(input)).not.toBe(computeFinalSeal({ ...input, decision: { ...decision, eligibleCount: 201 } }));
    expect(computeFinalSeal(input)).not.toBe(computeFinalSeal({ ...input, decision: { ...decision, decisionStatus: 'tie' } }));
  });
});
