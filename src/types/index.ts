
export type Role = 'admin' | 'member';

export interface UserProfile {
  uid: string;
  email: string;
  role: Role;
  displayName: string;
  isAllowlisted: boolean;
}

export interface ProjectLink {
  label: string;
  url: string;
}

export interface Project {
  id: string;
  title: string;
  summary: string;
  longDescription?: string;
  budget: string;
  imageUrl?: string;
  keyFeatures: string[];
  ownerName?: string;
  ownerBio?: string;
  links?: ProjectLink[];
}

export interface VotingSession {
  id: string;
  title: string;
  announcementAt: Date;
  votingOpensAt: Date;
  votingClosesAt: Date;
  resultsPublishedAt?: Date;
  isResultsPublished: boolean;
  projects?: Project[];
  status: 'upcoming' | 'announcing' | 'open' | 'closed' | 'published';
  winnerProjectTitle?: string;
  totalBallotsCount?: number;
  rankingSummary?: { projectId: string; title: string; budget: string; rank: number }[];
}

export interface Ballot {
  id: string;
  sessionId: string;
  userId: string;
  ranking: string[]; // Order matters
  createdAt: Date;
}

export interface TallyResult {
  sessionId: string;
  winnerId: string;
  fullRanking: { projectId: string; rank: number }[];
  totalBallots: number;
  computedAt: Date;
}

export interface AllowlistedEmail {
  id: string;
  email: string;
  addedAt: Date;
  addedBy: string;
}
