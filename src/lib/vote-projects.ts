import type { Project, Vote } from '@/types';

export type ProposalSnapshot = Pick<Project, 'id' | 'title' | 'summary' | 'longDescription' |
  'budget' | 'ownerName' | 'ownerBio' | 'imageUrl' | 'links'> & {
  contentFrozen: true;
  mediaVersions: { field: string; sha256: string; contentType: string; bytes: number }[];
};
export type ProposalSource = Pick<Vote, 'projectIds' | 'proposalSnapshotVersion' | 'proposalSnapshots'>;

/** Never substitute today's catalogue for a missing/corrupt versioned snapshot. */
export function projectsForVote(vote: ProposalSource | null | undefined, live: Project[] = []): Project[] {
  if (!vote) return [];
  if (vote.proposalSnapshotVersion != null) {
    if (vote.proposalSnapshotVersion !== 1 || !Array.isArray(vote.proposalSnapshots) ||
        vote.proposalSnapshots.length !== vote.projectIds?.length ||
        vote.projectIds.some((id, i) => vote.proposalSnapshots![i]?.id !== id)) return [];
    return vote.proposalSnapshots.map(p => ({ ...p, status: 'candidate', createdAt: null, updatedAt: null }));
  }
  return live.filter(p => vote.projectIds?.includes(p.id));
}

export const HISTORICAL_PROPOSALS_NOTICE = 'Contenu historique non figé : les informations disponibles proviennent du catalogue actuel et peuvent différer de celles présentées lors du vote.';
