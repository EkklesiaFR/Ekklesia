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
  description?: string;
  budget: string;
  imageUrl?: string;
}

export interface Assembly {
  id: string;
  title: string;
  state: 'draft' | 'open' | 'closed';
  createdAt: any;
  createdBy: string;
  startsAt?: any;
  endsAt?: any;
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
