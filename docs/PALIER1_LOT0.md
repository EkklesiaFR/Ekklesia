# Palier 1 — Lot 0

Référence : e0751cefc1ee827b735582390a14ff3af5da9b85 (origin/main).

## Périmètre

Les écritures de projets sont réservées aux administrateurs actifs du profil racine.
La lecture membre existante est conservée ; ownerUid ne confère plus de droit.
La modale membre inutilisée est supprimée. Le générateur de résumé IA est conservé,
sans nouvel appel ni éditeur. Les statuts des membres ne sont pas modifiés.
Le tarif devient 1 € par mois, avec paiement annoncé comme à venir.
La card Cagnotte reste présente, sans montant, variation, faux zéro ou lien.
Aucune logique ni règle de vote, résultat, snapshot, PV ou vérification n'est changée.
Aucune migration de données, configuration de paiement ou intervention en production.

## Projets publics

/api/public/home demande uniquement status == candidate, avec limit(5).
Le filtrage précède la limite, côté Firestore. Aucun tri par createdAt : les cinq
premiers candidats suivent l'ordre implicite des identifiants de documents, sans
promesse de récence. Cela évite un nouvel index composite et une lecture de tout
le catalogue. Aucun index ni backfill ajouté. Un candidat sans createdAt reste
publiable ; tous les autres statuts, y compris absent ou inconnu, sont exclus.
Le DTO public garde sa liste limitée de champs, sans coordonnées du propriétaire.

## Statuts membres : constat et proposition séparée

L'inventaire porte sur les fichiers versionnés de src, tests, docs, scripts et
les règles au SHA de référence. Les lignes correspondent à cette référence.

- src/types/index.ts:2 : MemberStatus contient blocked et revoked, pas disabled.
- src/app/admin/members/page.tsx:22,75,123,138,142 : le type local, le handler,
  le sélecteur, la désactivation et le rendu utilisent le statut disabled.
- docs/backend.json:30 : blocked est déclaré ; disabled et revoked sont absents.
- tests/vote.emulator.test.ts:60,84,100,250,265,327,409 : refus/suspension avec
  blocked et, ligne 60, revoked.
- Les autres disabled sont des propriétés/attributs/styles UI, pas des statuts.
- src/firebase/non-blocking-login.tsx:38,39 désigne une popup bloquée, pas un membre.

Les autorisations existantes exigent status == active : les trois valeurs non actives
restent refusées, mais le gestionnaire admin ne les représente pas uniformément.
Aucune réécriture de données ni correction de type/UI membre dans ce lot.

Proposition séparée sans migration : étendre le type local admin à
MemberStatus | 'disabled' et afficher distinctement blocked/revoked/disabled,
sans modifier les transitions ni normaliser à la sauvegarde. Remplacer automatiquement
disabled par blocked n'est pas une correction neutre. La séparation
accountStatus/membershipStatus/role reste aux lots suivants.

Les nouveaux tests projects.emulator.test.ts ajoutent blocked, revoked et disabled
à la matrice de refus de projets, sans modifier le métier.

## Inventaire exhaustif à la référence

Une ligne peut contenir plusieurs occurrences. Les homonymes UI sont inclus.

| Fichier | Lignes contenant disabled, blocked ou revoked |
| --- | --- |
| docs/backend.json | 30 |
| src/app/account/page.tsx | 35, 41, 47, 62, 72, 172, 231, 239 |
| src/app/admin/members/page.tsx | 22, 75, 104, 116, 123, 133, 138, 142, 143, 147 |
| src/app/admin/page.tsx | 292, 303, 314 |
| src/app/forgot-password/page.tsx | 50 |
| src/app/login/page.tsx | 206, 249, 275, 282 |
| src/app/results/[voteId]/ResultsVoteDetailClient.tsx | 77, 244 |
| src/app/results/page.tsx | 70, 214 |
| src/app/signup/page.tsx | 108 |
| src/components/admin/CreateSessionModal.tsx | 374 |
| src/components/layout/MobileNav.tsx | 19, 48, 62 |
| src/components/projects/SubmitProjectModal.tsx | 144, 207 |
| src/components/ui/button.tsx | 8 |
| src/components/ui/carousel.tsx | 215, 244 |
| src/components/ui/checkbox.tsx | 16 |
| src/components/ui/dialog.tsx | 47 |
| src/components/ui/dropdown-menu.tsx | 86, 102, 126 |
| src/components/ui/input.tsx | 11 |
| src/components/ui/label.tsx | 10 |
| src/components/ui/menubar.tsx | 139, 155, 178 |
| src/components/ui/radio-group.tsx | 31 |
| src/components/ui/select.tsx | 22, 121 |
| src/components/ui/sheet.tsx | 68 |
| src/components/ui/sidebar.tsx | 515, 725 |
| src/components/ui/slider.tsx | 23 |
| src/components/ui/switch.tsx | 14 |
| src/components/ui/tabs.tsx | 32 |
| src/components/ui/textarea.tsx | 10 |
| src/components/ui/toast.tsx | 65 |
| src/components/vote/VoteModule.tsx | 283 |
| src/components/voting/RankedList.tsx | 28, 34, 37, 48, 65, 86, 102, 143, 154 |
| src/firebase/non-blocking-login.tsx | 38, 39 |
| src/types/index.ts | 2 |
| tests/vote.emulator.test.ts | 60, 84, 100, 250, 265, 327, 409 |

## Validation

Les nouveaux tests utilisent exclusivement demo-ekklesia-test et refusent de
démarrer sans les deux variables d'émulateur. Ils vérifient le SDK client soumis
aux vraies règles, les profils root/mirror et les lectures membre conservées.
La route publique est appelée avec le vrai Firestore Emulator : statuts interdits,
filtrage avant limite, absence de champs privés, absence/retrait de candidats.

Recette : npm run lint, npm run typecheck, npm run test:run,
npm run test:emulator, npm run build, puis npm run test:browser sur émulateurs.
Les résultats effectifs sont rapportés dans le compte rendu du commit.

### Résultats exécutés

- Lint : réussi, cinq avertissements préexistants dans des fichiers non modifiés.
- TypeScript : réussi.
- Unitaires : 49 tests réussis, 7 fichiers.
- Auth/Firestore Emulator : 66 tests réussis, dont 13 nouveaux tests projets/home.
- Build : réussi ; avertissement préexistant sur experimental.allowedDevOrigins.
- Playwright vote existant : 1 scénario réussi (2,6 minutes au total), incluant
  dépôt/révision, publication, résultats/PDF, constats sans vainqueur et archives.

Recette navigateur sous Chromium système 138, avec PLAYWRIGHT_CHROMIUM_EXECUTABLE
et une configuration FONTCONFIG_FILE temporaire utilisant les polices Figtree du
repo, comme dans la recette documentée du vote. Aucun changement de configuration
produit ou de test nécessaire. Les contextes navigateur existants bloquent les
requêtes hors localhost ; les deux émulateurs utilisent demo-ekklesia-test.

Revue : toutes les règles Firestore hors projects sont identiques octet pour octet
à la référence. Aucun diff sur le moteur, les résultats, les snapshots, le PV,
le scellé, verify, les tests de vote existants, Storage ou les dépendances.
Les anciens prix/chiffres/libellés ont disparu du code produit ; la card ne contient
ni montant ni lien. L'incohérence des statuts membres reste volontairement différée.
