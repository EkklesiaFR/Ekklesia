Architecture Technique — Ekklesia Vote
Version : v0.5.1
Dernière mise à jour : 05 Mars 2026

Ce document décrit l’architecture logicielle et le modèle de sécurité de la plateforme Ekklesia Vote.

L’objectif de cette architecture est de garantir :

- la transparence du vote
- l’intégrité des résultats
- la séparation des privilèges

une architecture simple, robuste et auditable

### 1. Stack Technique

- Framework : Next.js 15 (App Router)
- Langage : TypeScript
- UI : Tailwind CSS + ShadCN UI
- Backend : Firebase
- Firebase Auth
- Cloud Firestore
- Algorithme de vote : Méthode de Schulze (Condorcet)
- PDF : PDFKit
- Hash / Scellage : SHA-256 + HMAC
- Tests : Vitest
- CI : GitHub Actions

### 2. Architecture Frontend

L’application suit une architecture modulaire React / Next.js afin de séparer clairement :

- l’interface utilisateur
- la logique métier
- l’accès aux données

Structure principale du projet :

src/
app/ → pages et routes API
components/ → composants UI
hooks/ → hooks Firestore et logique client
lib/ → logique métier (tally, crypto, utils)
firebase/ → configuration Firebase

### 3. Gestion des utilisateurs

L’authentification est gérée par Firebase Auth.
Les profils utilisateurs sont stockés dans Firestore afin d’ajouter des rôles et des statuts.

Le composant principal :
src/components/auth/AuthStatusProvider.tsx

Expose en temps réel :
- uid
- rôle
- statut
- informations du profil

Ces données sont utilisées dans toute l’application pour contrôler l’accès aux fonctionnalités.

### 4. Système de Gardes (Access Control)

Certaines pages sont protégées par des composants de garde.

Exemple :
RequireActiveMember

Ce composant vérifie :
- utilisateur authentifié
- statut du membre (status == active)
- autorisation d’accès à l’assemblée

Les comptes pending ou blocked ne peuvent pas accéder aux fonctionnalités de vote.

### 5. Modèle de Données Firestore

#### Membres

Collection :
members/{uid}

Champs principaux :
- role : "admin" | "member"
- status : "active" | "pending" | "blocked"
- displayName
- photoURL
- createdAt

#### Assemblées
Collection :
assemblies/{assemblyId}

Champs :
- state : "draft" | "open" | "locked"
- activeVoteId : identifiant du vote en cours
- createdAt
- updatedAt

#### Scrutins
Collection :
assemblies/{assemblyId}/votes/{voteId}

Champs principaux :
- question
- method : "schulze"
- eligibleCount
- ballotCount
- state : "draft" | "open" | "locked"

Résultats :
- winnerId
- fullRanking
- total
- computedAt
- resultsHash

#### Bulletins
Collection :
assemblies/{assemblyId}/votes/{voteId}/ballots/{uid}

Structure :
- ranking : liste ordonnée des projets
- castAt : timestamp

Chaque membre possède un seul bulletin identifié par son UID, ce qui empêche le double vote.

#### Résultat public dénormalisé

Afin de faciliter l'affichage rapide des résultats pour les utilisateurs,
un document dénormalisé est maintenu :

assemblies/{assemblyId}/public/lastResult

Ce document contient une version simplifiée du dernier résultat publié
afin d’éviter de parcourir l’historique complet des scrutins.

Champs typiques :

- voteId
- winnerId
- winnerLabel
- fullRanking
- total
- resultsHash
- computedAt

### 6. Sécurité Firestore

Les règles de sécurité sont définies dans :
firestore.rules

Principe appliqué : moindre privilège.

#### Membres
- peuvent lire leur propre profil
- ne peuvent modifier que certains champs autorisés

#### Bulletins

Les membres :
- ne peuvent pas lister les bulletins
- peuvent lire et modifier uniquement leur bulletin

Seul l’utilisateur dont auth.uid == uid peut accéder au document :
- ballots/{uid}

Cela garantit le secret du scrutin.

### 7. Dépouillement des votes (Server Side)

Le dépouillement est effectué côté serveur via une route API sécurisée.

Route principale :

src/app/api/admin/assemblies/[assemblyId]/votes/[voteId]/publish/route.ts

Workflow :

Un administrateur déclenche l’action Publier les résultats.
Le client appelle la route API serveur.

Le serveur vérifie :
- authentification Firebase
- rôle admin
- statut active
- état du vote (open)

Le serveur lit tous les bulletins.
L’algorithme Schulze calcule le classement.
Un hash de résultat (resultsHash) est généré.
Les résultats sont enregistrés via une écriture Firestore atomique.

#### Traçabilité de clôture

Lors de la publication des résultats, le document du vote est enrichi avec :

- lockedAt : timestamp de clôture
- lockedBy : identifiant de l’administrateur ayant publié les résultats

Ces champs permettent d'assurer la traçabilité et l'audit du scrutin.

### 8. Atomicité et Idempotence

La publication des résultats possède deux propriétés importantes.

#### Atomicité
Toutes les écritures Firestore sont regroupées dans un batch.

Cela garantit que :
- soit toutes les écritures réussissent
- soit aucune modification n’est appliquée

#### Idempotence
Si le vote est déjà verrouillé (state == locked) :
- la route API renvoie simplement OK sans recalcul.

Cela permet de relancer l’opération sans risque d’incohérence.

### 9. Scellage cryptographique des résultats

Deux niveaux de preuve sont utilisés.

- resultsHash

Hash SHA-256 d’un objet canonique contenant :
- méthode de vote
- voteId
- liste des projets
- nombre de bulletins
- classement final

Stocké dans :
assemblies/{assemblyId}/votes/{voteId}.results.resultsHash

#### finalSeal
Un scellé cryptographique plus robuste est généré pour le procès-verbal.

Il inclut :
- résultats
- timestamp
- métadonnées
- Calculé via HMAC.

La logique se trouve dans :
src/lib/pv/seal.ts

### 10. Procès-Verbal (PV)

Un procès-verbal officiel est généré en PDF.

Route :
src/app/api/pv/[assemblyId]/[voteId]/pdf/route.ts

Le PV contient :
- question du vote
- nombre de votants
- classement final
- resultsHash
- finalSeal

Un QR Code permet de vérifier le scellé via :
/verify?seal=...

#### Annexe d’émargement pseudonymisée

Optionnellement, le PV peut inclure une liste pseudonymisée des votants.

Cette fonctionnalité est activée via la variable d’environnement :

PV_INCLUDE_PSEUDOLIST

Lorsque activée :
- une annexe contient la liste des participants
- chaque identifiant est pseudonymisé via HMAC

Cela permet de prouver la participation sans révéler directement l’identité des votants.

### 11. Présence en ligne

La présence des membres peut être suivie via une collection dédiée.

Structure :
assemblies/{assemblyId}/presence/{uid}

Champs :
- status
- lastSeenAt
- sessionId
- photoURL

Cela permet d’afficher les membres connectés en temps réel.

### 12. Tests et CI

Le projet inclut :
- tests unitaires (Vitest)
- pipeline CI GitHub

Workflow CI :
- lint
- typecheck
- tests
- build

Objectif : prévenir les régressions et garantir la stabilité du code.

### 13. Limites actuelles et évolutions

#### Scalabilité
Le dépouillement charge tous les bulletins en mémoire.

- Ordres de grandeur :
~1 000 votants → aucun problème
~10 000 votants → possible mais plus lourd
100 000 votants → nécessitera traitement par lots

### 14. Objectif du projet

Ekklesia Vote vise à proposer un système de vote :
- transparent
- auditable
- compréhensible

tout en restant simple à utiliser et robuste techniquement.