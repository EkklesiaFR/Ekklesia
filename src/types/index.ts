import type { ProposalSnapshot } from '@/lib/vote-projects';
export type MemberStatus = 'active' | 'pending' | 'blocked' | 'revoked';
export type Role = 'admin' | 'member';

export interface MemberProfile {
  id: string;
  email: string;
  displayName?: string;

  /**
   * URL de la photo de profil du membre.
   * - Source principale utilisée par l'app
   * - Peut être synchronisée avec Firebase Auth (user.photoURL)
   * - Peut être null si aucun avatar défini
   */
  photoURL?: string | null;

  status: MemberStatus;
  role: Role;

  joinedAt?: any;
  lastLoginAt?: any;
  createdAt?: any;

  /**
   * Bio courte du membre (optionnelle)
   */
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
  links?: { label: string; url: string; download?: string }[];
  contentFrozen?: boolean;

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

  /**
   * État global de l'assemblée
   * - draft: préparation
   * - open: active
   * - locked: fermée
   */
  state: 'draft' | 'open' | 'locked';

  createdAt: any;
  createdBy: string;

  startsAt?: any;
  endsAt?: any;

  /**
   * Vote actif en cours dans l'assemblée
   */
  activeVoteId?: string;
}

export interface Vote {
  id: string;
  assemblyId: string;

  question: string;
  projectIds: string[];

  /**
   * État du vote
   * - draft: préparation
   * - open: vote en cours
   * - locked: terminé (résultats figés)
   */
  state: 'draft' | 'open' | 'locked';

  opensAt?: any;
  closesAt?: any;
  deadlineEnforced?: boolean;
  eligibilityPolicy?: 'snapshot-active-v1';
  rulesVersion?: 1;
  counterVersion?: number;
  proposalSnapshotVersion?: 1;
  proposalSnapshots?: ProposalSnapshot[];
  proposalContentHash?: string;

  createdAt?: any;
  createdBy?: string;

  ballotCount?: number;

  /**
   * Snapshot du nombre de votants éligibles
   * au moment de l'ouverture du vote
   */
  eligibleCountAtOpen?: number;

  /**
   * Timestamp réel d'ouverture du vote
   */
  openedAt?: any;

  /**
   * UID de l'admin qui a ouvert le vote
   */
  openedBy?: string;

  /**
   * Seuil en % (0-100) : en v1, condition d'adoption, sans blocage de la clôture.
   * - Si absent => traité comme 0 (compat votes historiques)
   * - Calcul basé sur eligibleCountAtOpen (figé à l'ouverture)
   */
  quorumPct?: number;

  results?: {
    /**
     * ID du projet gagnant
     */
    winnerId: string | null;
    outcome?: 'counted' | 'no-ballots';
    rulesVersion?: 1;
    decisionStatus?: 'adopted' | 'quorum-not-met' | 'no-ballots' | 'tie';
    adopted?: boolean;
    tiedWinnerIds?: string[];
    eligibleCount?: number;
    quorumPct?: number;
    proposalContentHash?: string;

    /**
     * Classement complet des projets
     */
    fullRanking: {
      id: string;
      rank: number;
      score?: number;
      title?: string;
    }[];

    computedAt: any;
    total: number;
  };
}

export interface Ballot {
  id: string; // user uid

  /**
   * Ordre de préférence des projets
   */
  ranking: string[];

  castAt: any;
  updatedAt: any;
}

// ========================
// Notifications
// ========================

export type NotificationType =
  | "vote_created"
  | "vote_locked"
  | "member_activated";

export type Notification = {
  id: string;
  type: NotificationType;
  title: string;
  body?: string;
  link?: string;
  read: boolean;
  createdAt: any; // volontairement souple pour éviter conflit Timestamp / Date
  assemblyId?: string;
  voteId?: string;
};
