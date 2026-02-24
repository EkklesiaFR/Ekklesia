export type MemberStatus = 'active' | 'pending' | 'revoked';
export type Role = 'admin' | 'member';

export interface MemberProfile {
  status: MemberStatus;
  role: Role;
  joinedAt?: any;
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
  status: "draft" | "submitted" | "approved" | "elected" | "rejected" | "candidate";
  createdAt: any;
  updatedAt: any;
  ownerUid?: string;
  ownerEmail?: string;
  sessionId?: string;
}

export interface Assembly {
  id: string;
  title: string;
  state: 'draft' | 'open' | 'closed';
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
  state: 'draft' | 'open' | 'closed';
  opensAt?: any;
  closesAt?: any;
  createdAt?: any;
  createdBy?: string;
}

export interface Ballot {
  id: string; // user uid
  ranking: string[]; // array of project ids
  castAt: any;
  updatedAt: any;
}
