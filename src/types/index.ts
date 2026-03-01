export type MemberStatus = 'active' | 'pending' | 'blocked' | 'revoked';
export type Role = 'admin' | 'member';

export interface MemberProfile {
  id: string;
  email: string;
  displayName?: string;
  status: MemberStatus;
  role: Role;
  joinedAt?: any;
  lastLoginAt?: any;
  createdAt?: any;
  bio?: string;
}

export interface Project {
  id: string;
  title: string;
  summary: string;
  longDescription?: string;
  budget: string;
  imageUrl?: string;
  ownerName?: string;
  ownerBio?: string;
  links?: { label: string; url: string }[];
  status: 'draft' | 'submitted' | 'approved' | 'elected' | 'rejected' | 'candidate';
  createdAt: any;
  updatedAt: any;
  ownerUid?: string;
  ownerEmail?: string;
  sessionId?: string;
}

export interface Assembly {
  id: string;
  title: string;
  state: 'draft' | 'open' | 'locked';
  createdAt: any;
  createdBy: string;
  startsAt?: any;
  endsAt?: any;
  activeVoteId?: string;
}

export interface Vote {
  id: string;
  assemblyId: string;
  question: string;
  projectIds: string[];
  state: 'draft' | 'open' | 'locked';
  opensAt?: any;
  closesAt?: any;
  createdAt?: any;
  createdBy?: string;
  ballotCount?: number;

  eligibleCountAtOpen?: number; // Snapshot of eligible voters at the moment the vote was opened
  openedAt?: any; // Timestamp when the vote was opened
  openedBy?: string; // UID of the admin who opened the vote

  /**
   * Quorum minimum en % (0-100) pour considérer le vote comme valide.
   * - Si absent => traité comme 0 (compat votes historiques)
   * - Calcul basé sur eligibleCountAtOpen (déjà figé à l'ouverture)
   */
  quorumPct?: number;

  results?: {
    // Official results (after closing/publishing)
    winnerId: string;
    fullRanking: { id: string; rank: number; score?: number }[];
    computedAt: any;
    total: number;
  };
}

export interface Ballot {
  id: string; // user uid
  ranking: string[]; // array of project ids
  castAt: any;
  updatedAt: any;
}