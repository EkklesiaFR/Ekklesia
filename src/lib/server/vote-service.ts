import { createHash } from 'node:crypto';
import { FieldValue, Timestamp, type Firestore, type Transaction } from 'firebase-admin/firestore';
import { computeSchulzeResults, computeSchulzeOutcome } from '../tally';
import { decideVote, decisionLabel } from '../vote-decision';
import { projectsForVote, type ProposalSnapshot } from '../vote-projects';
import { snapshotProject, checkPublishableSize, checkSnapshotSize, contentHash, ProposalError, newSnapshotBudget } from './proposal-snapshot';

export class VoteError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

function id(value: string) {
  if (!value || value.includes('/') || value === '.' || value === '..') {
    throw new VoteError(400, 'Invalid identifier');
  }
  return value;
}

function refs(db: Firestore, assemblyId: string, voteId: string) {
  const assembly = db.collection('assemblies').doc(id(assemblyId));
  return { assembly, vote: assembly.collection('votes').doc(id(voteId)) };
}

async function requireMember(tx: Transaction, db: Firestore, uid: string, admin = false) {
  if (!uid) throw new VoteError(401, 'Unauthorized');
  // Root profile is the authority used by AuthStatusProvider and the admin APIs.
  const member = (await tx.get(db.collection('members').doc(id(uid)))).data();
  if (member?.status !== 'active' || !['member', 'admin'].includes(member.role) ||
      (admin && member.role !== 'admin')) throw new VoteError(403, 'Active membership required');
}

function projects(value: unknown): string[] {
  if (!Array.isArray(value) || value.length === 0 ||
      value.some(p => typeof p !== 'string' || !p || p.includes('/') || p === '.' || p === '..') ||
      new Set(value).size !== value.length) throw new VoteError(409, 'Invalid vote projects');
  return value;
}

export function validRanking(value: unknown, projectIds: string[]): value is string[] {
  return Array.isArray(value) && value.length > 0 && value.length <= projectIds.length &&
    value.every(p => typeof p === 'string' && projectIds.includes(p)) &&
    new Set(value).size === value.length;
}

function deadline(vote: FirebaseFirestore.DocumentData) {
  // Historical closesAt was explicitly advertised as indicative. Never reinterpret it.
  if (vote.deadlineEnforced !== true) return null;
  const ms = vote.closesAt?.toMillis?.();
  if (!Number.isFinite(ms)) throw new VoteError(409, 'Invalid enforced deadline');
  return ms as number;
}

function checkProposalSnapshot(data: FirebaseFirestore.DocumentData) {
  if (data.proposalSnapshotVersion == null) return; // Historical: never reconstruct.
  if (data.proposalSnapshotVersion !== 1 || !Array.isArray(data.proposalSnapshots) ||
      projectsForVote(data as Parameters<typeof projectsForVote>[0]).length !== projects(data.projectIds).length ||
      contentHash(data.proposalSnapshots) !== data.proposalContentHash) {
    throw new VoteError(409, 'Contenu figé du scrutin manquant ou invalide.');
  }
}

export async function submitBallot(db: Firestore, uid: string, assemblyId: string, voteId: string, ranking: unknown) {
  const { assembly, vote } = refs(db, assemblyId, voteId);
  return db.runTransaction(async tx => {
    await requireMember(tx, db, uid);
    const assemblySnap = await tx.get(assembly);
    const snap = await tx.get(vote);
    if (!assemblySnap.exists || !snap.exists) throw new VoteError(404, 'Vote not found');
    const data = snap.data()!;
    if (data.state !== 'open') throw new VoteError(409, 'Vote is not open');
    checkProposalSnapshot(data);
    if (data.rulesVersion === 1 && data.eligibilityPolicy !== 'snapshot-active-v1') {
      throw new VoteError(409, 'Missing electorate policy');
    }
    if (data.eligibilityPolicy === 'snapshot-active-v1') {
      const electorate = (await tx.get(vote.collection('electorate').doc('snapshot'))).data();
      if (!Array.isArray(electorate?.uids)) throw new VoteError(409, 'Missing electorate snapshot');
      if (!electorate.uids.includes(uid)) throw new VoteError(403, 'Not eligible at opening');
    } else if (data.eligibilityPolicy != null) {
      throw new VoteError(409, 'Unknown eligibility policy');
    }
    const expires = deadline(data);
    if (expires !== null && Date.now() >= expires) throw new VoteError(409, 'Voting deadline passed');
    if (!validRanking(ranking, projects(data.projectIds))) throw new VoteError(400, 'Invalid ranking');
    const ballot = vote.collection('ballots').doc(uid);
    const previous = await tx.get(ballot);
    // Recount once for old data (including counters corrupted by direct browser writes).
    // The vote document serializes all submissions, including updates with unchanged count.
    const count = data.counterVersion === 1 && Number.isSafeInteger(data.ballotCount) && data.ballotCount >= 0
      ? data.ballotCount : (await tx.get(vote.collection('ballots'))).size;
    if (expires !== null && Date.now() >= expires) throw new VoteError(409, 'Voting deadline passed');
    tx.update(vote, { ballotCount: count + (previous.exists ? 0 : 1), counterVersion: 1 });
    tx.set(ballot, {
      ranking,
      castAt: previous.data()?.castAt ?? FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    return { success: true };
  });
}

export async function openVote(db: Firestore, uid: string, assemblyId: string, voteId: string, mediaRequest: typeof fetch = fetch) {
  const { assembly, vote } = refs(db, assemblyId, voteId);
  // Authorize before network access. Prepare bytes outside transactions; recheck all versions
  // at commit so edits during a download cannot mix old media with new text/project IDs.
  const prepared = await db.runTransaction(async tx => {
    await requireMember(tx, db, uid, true);
    const assemblySnap = await tx.get(assembly);
    const snap = await tx.get(vote);
    if (!assemblySnap.exists || !snap.exists) throw new VoteError(404, 'Vote not found');
    if (snap.data()!.state === 'open') return null;
    if (snap.data()!.state !== 'draft' || snap.data()!.results) throw new VoteError(409, 'Only clean draft votes can be opened');
    const ids = projects(snap.data()!.projectIds);
    const source = await tx.getAll(...ids.map(p => db.collection('projects').doc(p)));
    if (source.some(p => !p.exists)) throw new VoteError(409, 'Projet manquant : ouverture annulée.');
    return { voteVersion: snap.updateTime!, draft: snap.data()!, source };
  });
  if (!prepared) return { ok: true, alreadyOpen: true };
  const proposalSnapshots: ProposalSnapshot[] = [];
  const budget = newSnapshotBudget();
  try {
    for (const source of prepared.source) {
      proposalSnapshots.push(await snapshotProject(source.id, source.data()!, mediaRequest, budget));
      checkSnapshotSize(proposalSnapshots);
    }
    checkPublishableSize(prepared.draft, proposalSnapshots);
  } catch (error) {
    if (error instanceof ProposalError) throw new VoteError(409, error.message);
    throw error;
  }
  return db.runTransaction(async tx => {
    await requireMember(tx, db, uid, true);
    const assemblySnap = await tx.get(assembly);
    const snap = await tx.get(vote);
    if (!assemblySnap.exists || !snap.exists) throw new VoteError(404, 'Vote not found');
    const data = snap.data()!;
    if (data.state === 'open') return { ok: true, alreadyOpen: true };
    if (data.state !== 'draft' || data.results) throw new VoteError(409, 'Only clean draft votes can be opened');
    const currentProjects = await tx.getAll(...prepared.source.map(p => p.ref));
    if (!snap.updateTime!.isEqual(prepared.voteVersion) || currentProjects.some((p, i) =>
      !p.exists || !p.updateTime!.isEqual(prepared.source[i].updateTime!))) {
      throw new VoteError(409, 'Le scrutin ou un projet a changé pendant la copie. Relancer l’ouverture.');
    }
    if (data.eligibilityPolicy != null && data.eligibilityPolicy !== 'snapshot-active-v1') {
      throw new VoteError(409, 'Unknown eligibility policy');
    }
    if (data.rulesVersion != null && data.rulesVersion !== 1) throw new VoteError(409, 'Unknown voting rules');
    if (data.rulesVersion === 1 && (data.eligibilityPolicy !== 'snapshot-active-v1' ||
      typeof data.quorumPct !== 'number' || !Number.isFinite(data.quorumPct) || data.quorumPct < 0 || data.quorumPct > 100)) {
      throw new VoteError(409, 'Invalid voting rules');
    }
    if (data.rulesVersion === 1 && data.closesAt != null && data.deadlineEnforced !== true) {
      throw new VoteError(409, 'New voting deadlines must be enforced');
    }
    projects(data.projectIds);
    const expires = deadline(data);
    if (expires !== null && expires <= Date.now()) throw new VoteError(409, 'Voting deadline passed');
    const open = await tx.get(assembly.collection('votes').where('state', '==', 'open'));
    if (!open.empty) throw new VoteError(409, 'Another vote is active');
    const ballots = await tx.get(vote.collection('ballots'));
    if (!ballots.empty) throw new VoteError(409, 'Draft already contains ballots; review required');
    const eligible = await tx.get(db.collection('members').where('status', '==', 'active'));
    const eligibleUids = eligible.docs.filter(d => ['member', 'admin'].includes(d.data().role)).map(d => d.id);
    const eligibleCountAtOpen = eligibleUids.length;
    if (data.rulesVersion === 1 && !eligibleCountAtOpen) throw new VoteError(409, 'No eligible voters');
    const now = FieldValue.serverTimestamp();
    if (data.eligibilityPolicy === 'snapshot-active-v1') {
      // Keep identities out of the member-readable vote document. No historical reconstruction.
      tx.set(vote.collection('electorate').doc('snapshot'), { uids: eligibleUids, createdAt: now });
    }
    tx.update(vote, { state: 'open', eligibleCountAtOpen, ballotCount: 0, counterVersion: 1,
      proposalSnapshotVersion: 1, proposalSnapshots, proposalContentHash: contentHash(proposalSnapshots),
      openedAt: now, openedBy: uid, updatedAt: now });
    tx.update(assembly, { state: 'open', activeVoteId: voteId, updatedAt: now });
    return { ok: true, alreadyOpen: false, eligibleCountAtOpen };
  });
}

export async function publishVote(db: Firestore, uid: string, assemblyId: string, voteId: string) {
  const { assembly, vote } = refs(db, assemblyId, voteId);
  return db.runTransaction(async tx => {
    await requireMember(tx, db, uid, true);
    const assemblySnap = await tx.get(assembly);
    const snap = await tx.get(vote);
    if (!assemblySnap.exists || !snap.exists) throw new VoteError(404, 'Vote not found');
    const data = snap.data()!;
    // Never recalculate or mutate historical locked results, even if incomplete.
    if (data.state === 'locked') return { ok: true, alreadyLocked: true, results: data.results ?? null };
    if (data.state !== 'open') throw new VoteError(409, 'Vote is not open');
    checkProposalSnapshot(data);
    const projectIds = projects(data.projectIds);
    const ballotsSnap = await tx.get(vote.collection('ballots'));
    const ballots = ballotsSnap.docs.map(d => d.data());
    if (!ballots.length && data.rulesVersion !== 1) throw new VoteError(409, 'No ballots; legacy rules do not publish empty votes');
    if (ballots.some(b => !validRanking(b.ranking, projectIds))) {
      throw new VoteError(409, 'Invalid historical ballots; review required before publication');
    }
    // Closing an empty vote records a fact, not an artificial identifier-tie winner.
    const tally = ballots.length ? computeSchulzeResults(projectIds, ballots as { ranking: string[] }[])
      : { winnerId: null, ranking: [], total: 0 };
    const outcome = data.rulesVersion === 1 ? computeSchulzeOutcome(projectIds, ballots as { ranking: string[] }[]) : null;
    if (data.rulesVersion === 1 && (!Number.isSafeInteger(data.eligibleCountAtOpen) || data.eligibleCountAtOpen <= 0)) {
      throw new VoteError(409, 'Missing original electorate count');
    }
    const decision = outcome ? decideVote(ballots.length, data.eligibleCountAtOpen, data.quorumPct, outcome.winnerIds) : null;
    const winnerId = decision ? decision.winnerId : tally.winnerId;
    const frozen = projectsForVote(data as Parameters<typeof projectsForVote>[0]);
    const ranking = (outcome ? outcome.ranking : tally.ranking).map(row => data.proposalSnapshotVersion === 1
      ? { ...row, title: frozen.find(p => p.id === row.id)!.title } : row);
    const winner = winnerId && data.proposalSnapshotVersion == null ? await tx.get(db.collection('projects').doc(winnerId)) : null;
    const proposalSeal = data.proposalSnapshotVersion === 1 ? { proposalContentHash: data.proposalContentHash } : {};
    // Also supports old assemblies with several open votes, without clearing another vote.
    const open = await tx.get(assembly.collection('votes').where('state', '==', 'open'));
    const remaining = open.docs.map(d => d.id).filter(v => v !== voteId).sort();
    const current = assemblySnap.data()?.activeVoteId;
    const activeVoteId = remaining.includes(current) ? current : remaining[0] ?? null;
    const canonical = { method: 'schulze', voteId, projectIds, total: ballots.length,
      winnerId, fullRanking: ranking, ...proposalSeal, ...(decision ? { decision } : {}) };
    // Same JSON representation on the initial response and an idempotent retry from Firestore.
    const now = Timestamp.now();
    const results = { method: 'schulze', computedBy: uid,
      resultsHash: createHash('sha256').update(JSON.stringify(canonical)).digest('hex'),
      winnerId, fullRanking: ranking, computedAt: now, total: ballots.length,
      outcome: ballots.length ? 'counted' : 'no-ballots', ...proposalSeal, ...(decision ?? {}) };
    tx.update(vote, { state: 'locked', results, ballotCount: ballots.length, counterVersion: 1,
      lockedAt: now, lockedBy: uid, updatedAt: now });
    tx.update(assembly, { state: activeVoteId ? 'open' : 'locked', activeVoteId, updatedAt: now });
    tx.set(assembly.collection('public').doc('lastResult'), {
      ...results, voteId, voteTitle: data.title ?? data.question ?? '', closedAt: now, lockedAt: now,
      winnerLabel: winnerId ? frozen.find(p => p.id === winnerId)?.title || winner?.data()?.title || winnerId : decisionLabel(results),
    });
    return { ok: true, alreadyLocked: false, results };
  });
}
