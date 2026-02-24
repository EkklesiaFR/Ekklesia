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
}

export interface Vote {
  id: string;
  assemblyId: string;
  question: string;
  projectIds: string[];
  state: 'open' | 'closed';
  opensAt: any;
  closesAt: any;
}

export interface Ballot {
  id: string; // user uid
  ranking: string[]; // array of project ids
  castAt: any;
  updatedAt: any;
}
