# Architecture Technique - Ekklesia Vote

Ce document détaille l'architecture logicielle et le modèle de sécurité de la plateforme Ekklesia Vote.

## 1. Stack Technique
- **Framework** : Next.js 15 (App Router)
- **Langage** : TypeScript
- **Style** : Tailwind CSS + ShadCN UI
- **Backend** : Firebase (Auth & Firestore)
- **Algorithme de Vote** : Méthode de Schulze (Condorcet)

## 2. Architecture Frontend
L'application est structurée pour séparer strictement les privilèges :
- **Composants Partagés** : `MainLayout`, `Header`, `MobileNav`.
- **Système de Gardes** : Le composant `RequireActiveMember` protège l'accès aux pages en vérifiant le rôle et le statut Firestore.
- **Gestion d'État** : `AuthStatusProvider` fournit en temps réel les informations du profil membre (`active`, `pending`, `admin`).

## 3. Modèle de Données Firestore

### Profils Membres
`members/{uid}`
- `role`: "admin" | "member"
- `status`: "active" | "pending" | "blocked"

### Sessions d'Assemblée
`assemblies/{assemblyId}`
- `state`: "draft" | "open" | "locked"
- `activeVoteId`: ID du scrutin actuel (Source de vérité)

### Scrutins (Votes)
`assemblies/{assemblyId}/votes/{voteId}`
- `question`: Texte de la question
- `eligibleCount`: Quorum calculé à l'ouverture
- `ballotCount`: Nombre de bulletins reçus
- `results`: { winnerId, fullRanking, total, computedAt }

### Bulletins
`assemblies/{assemblyId}/votes/{voteId}/ballots/{uid}`
- `ranking`: [id_projet_1, id_projet_2, ...] (Ordre de préférence)
- `castAt`: Timestamp

## 4. Sécurité et Confidentialité
- **Secret du scrutin** : Les membres n'ont pas la permission `list` sur la collection des bulletins. Ils peuvent uniquement lire et modifier leur propre bulletin via leur UID.
- **Accès Admin** : Seuls les utilisateurs avec `role == "admin"` ET `status == "active"` peuvent lister les bulletins pour effectuer le dépouillement.
- **Intégrité** : Les règles Firestore utilisent des whitelists de champs (`hasOnly`) pour empêcher toute modification frauduleuse des compteurs ou des résultats.

## 5. Flux de Travail (Workflow)
1. **Création** : L'admin crée une session et y associe des projets.
2. **Ouverture** : L'admin ouvre la session. Le quorum est figé à cet instant.
3. **Vote** : Les membres classent les projets. Une transaction atomique enregistre le bulletin et incrémente le compteur global.
4. **Dépouillement** : Au clic sur "Clôturer", le client admin récupère tous les bulletins, calcule le vainqueur via l'algorithme Schulze et publie les résultats officiels.

## 6. Maintenance et Audit
- Le code de calcul Schulze se trouve dans `src/lib/tally.ts`.
- Les règles de sécurité se trouvent dans `firestore.rules`.
- La synchronisation du profil utilisateur se fait dans `src/components/auth/AuthStatusProvider.tsx`.
