
export type Role = 'admin' | 'member';

export interface UserProfile {
  uid: string;
  email: string;
  role: Role;
  displayName: string;
  isAllowlisted: boolean;
}

export interface Project {
  id: string;
  title: string;
  summary: string;
  budget: string;
  imageUrl?: string;
  keyFeatures: string[];
}

export interface VotingSession {
  id: string;
  title: string;
  announcementAt: Date;
  votingOpensAt: Date;
  votingClosesAt: Date;
  isResultsPublished: boolean;
  projects: Project[];
  status: 'upcoming' | 'announcing' | 'open' | 'closed' | 'published';
}

export interface Ballot {
  id: string;
  sessionId: string;
  userId: string;
  rankedProjectIds: string[]; // Order matters
  submittedAt: Date;
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
