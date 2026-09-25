# Fiabilisation du vote : dossier de revue

## État initial

Branche initiale `audit/claude-security`, SHA `9b529f0fcd012a1561ce7e24dba4e1fcdb9c2b1e`, arbre propre,
identique au `main` distant consulté pendant la mission. Aucun `AGENTS.md` trouvé. Branche de travail
`fix/vote-integrity`. Node 22 attendu par CI, contre Node 20 dans l'ancien environnement Studio.
La référence a été exécutée dans une copie isolée du SHA avec `npm ci` et le lockfile original.
Lint réussi avec six avertissements, TypeScript réussi, 26 tests réussis, build réussi.
Une première tentative de build, perturbée par une installation de dépendances partagée, a été
écartée ; le build de référence a été réexécuté avec ses propres dépendances et a réussi.
La CI utilisait `npm test` ; elle utilise désormais explicitement `test:run` et les émulateurs.

## Risques confirmés dans le SHA initial

| Chemin | Comportement observé et risque |
| --- | --- |
| `src/app/api/assemblies/[assemblyId]/votes/[voteId]/ballots/route.ts` | Jeton et tableau non vide seulement ; pas de membre actif, état, existence, échéance ou candidats. `tx.set` pouvait créer un scrutin inexistant. Agrégat de compteur lu hors transaction. |
| `firestore.rules`, `votes/ballots` | Écriture directe possible sans validation de classement ni mise à jour de compteur. Liste complète autorisée aux administrateurs. |
| `src/app/api/admin/assemblies/[assemblyId]/votes/[voteId]/open/route.ts` | Lecture puis batch, sans sérialisation de deux ouvertures ou d'une ouverture/publication. |
| `src/app/api/admin/assemblies/[assemblyId]/votes/[voteId]/publish/route.ts` | Bulletins lus avant verrouillage, double publication susceptible de remplacer les résultats ; anciens bulletins nettoyés sans le signaler. |
| `firestore.rules`, `votes`, `public`, `assemblies` | Champs ouverts modifiables, résultats injectables lors de création ou avant verrouillage, copie publique remplaçable après publication, état d'assemblée librement réinscriptible. |
| `src/hooks/useVoteBallotCount.ts`, `src/app/admin/page.tsx` | Membres et administrateurs lisaient des sources de participation différentes. |
| `src/app/api/pv/[assemblyId]/[voteId]/pdf/route.ts`, `src/app/api/verify/route.ts` | Aucun contrôle explicite `locked` avant scellage ; quorum comparé après arrondi ; texte prétendant sceller tout le PDF. |

## Correctif et garanties

`src/lib/server/vote-service.ts` centralise les trois transactions, utilisées par les routes HTTP.
Authentification Bearer ou session vérifiée ; électorat v1 figé à l’ouverture ; profil racine actif relu dans la transaction, y compris
pour les actions administrateur. Classement strict, partiel autorisé, bulletin UID unique,
remplacement sans incrément, rapprochement transactionnel des anciens compteurs.

La publication lit le scrutin et ses bulletins dans la transaction qui écrit le résultat. Le document
scrutin sert de point commun avec tous les dépôts. Il n'existe pas d'état intermédiaire persistant
susceptible de rester bloqué après interruption. Un double clic ou une réponse perdue se reprend
avec la même requête. Les anciens résultats verrouillés sont retournés tels quels.

L'ouverture refuse un autre scrutin réellement ouvert et répare un pointeur historique périmé sans
modifier les résultats anciens. La publication d'un ancien scrutin préserve un autre scrutin ouvert ;
les mises à jour de l'assemblée et de la dernière publication sont sérialisées ensemble.

Les règles réservent au serveur toutes les transitions et résultats, y compris leurs copies publiques.
Les brouillons restent préparables dans l'interface. Les compteurs navigateur ne listent plus de
bulletins ; un compteur historique inconnu n'est pas affiché comme un zéro certain.

Référence de sémantique Firestore : [isolation sérialisable des transactions](https://firebase.google.com/docs/firestore/transaction-data-contention).
La transaction charge tous les bulletins en mémoire et maintient des verrous durant le calcul : choix
simple adapté à l'application actuelle, sans garantie de débit pour de grandes élections. Les limites
Firestore (taille, durée, contention) restent applicables ; un échec avant commit permet une reprise.

## Décisions métier approuvées et compatibilité

Les règles sont versionnées sur les nouveaux brouillons (`rulesVersion: 1`) et annoncées dans le
formulaire puis l'écran de vote. Leur version ne peut être retirée ni changée par une écriture cliente.

- **Éligibilité v1 :** liste privée et nombre des membres actifs figés à l'ouverture dans la même
  transaction. Une activation tardive attend le scrutin suivant. Une suspension bloque les dépôts
  suivants, conserve le bulletin acquis et ne modifie pas la référence du quorum. Pas d'ouverture
  sans électeur ; les administrateurs actifs sont aussi électeurs, conformément au modèle existant.
- **Dates v1 :** toute date limite est explicitement contraignante et vérifiée côté serveur ; sans
  date, clôture manuelle. La publication reste manuelle, y compris après l'échéance. L'administrateur
  peut clôturer avant la date. L'horloge serveur fait autorité au contrôle transactionnel, sans promettre
  une borne sur la milliseconde exacte du commit réseau.
- **Quorum v1 :** référence = effectif initial figé ; comparaison exacte, pas de pourcentage arrondi
  utilisé pour décider. Sous le seuil : clôture et classement publiés, constat « Quorum non atteint —
  aucune décision adoptée », aucun vainqueur officiel.
- **Zéro bulletin v1 :** clôture possible même avec quorum 0 %, constat « Aucun bulletin — aucune
  décision adoptée », aucun vainqueur ni classement inventé.
- **Égalité v1 :** tous les maxima de la relation Schulze sont affichés ex æquo. Aucun départage par
  identifiant pour élire un vainqueur. Le classement utilise des rangs égaux. Un nouveau scrutin est
  une action distincte. Les plus forts chemins Schulze eux-mêmes restent inchangés.
- **Données :** `state` pour la clôture, `fullRanking` pour le calcul, `decisionStatus/adopted` pour
  l'adoption ; vainqueur nullable et liste des ex æquo. Résultats publics, admin, notifications et PV
  reprennent ces distinctions. Scellé v3 pour l'adoption/référence de quorum, v4 avec empreinte des
  propositions figées ; formats v2/v3 historiques inchangés.
- **Historique :** les brouillons existants et scrutins déjà ouverts sans version conservent les
  anciennes règles : membres actifs au dépôt, dates indicatives, pas de veto du quorum, départage par
  identifiant et publication vide refusée. Ni liste passée reconstituée ni résultat publié modifié.
  Un ancien scrutin vide peut nécessiter une décision opérationnelle avant le scrutin suivant.
- **Anomalies :** bulletin malformé ou brouillon déjà doté de bulletins : refus explicite nécessitant
  une revue humaine. Pas de migration destructive, de nettoyage silencieux ni d'opération production.

## Déploiement proposé — non exécuté

1. Répéter la recette sur un environnement de préproduction avec les deux émulateurs/tests CI,
   puis inventorier en lecture seule scrutins ouverts, compteurs, profils miroirs et anomalies.
2. Privilégier une fenêtre **sans scrutin ouvert**. Sinon suspendre réellement les accès aux anciennes
   routes de mutation pendant la bascule (un message d'interface n'est pas une suspension serveur).
3. Déployer l'application corrigée, retirer les anciennes instances/routes et attendre leurs requêtes
   en vol, puis déployer immédiatement les règles restrictives avant de rouvrir les accès. Entre ces
   étapes, les anciennes règles restent une voie de contournement : ne pas reprendre les votes.
   Déployer les règles seules ne sécurise pas l'ancienne API Admin, qui contourne les règles.
4. Vérifier les règles et parcours membre/admin, puis rouvrir. Les anciens clients de dépôt utilisant l'API restent compatibles ; les formulaires de création
   sans version et anciennes listes administrateur nécessitent un rechargement. Un premier dépôt rapproche un compteur ancien ; sinon il reste inconnu jusqu'à
   publication, sans backfill artificiel de l'éligibilité.
5. Ne pas revenir aux anciennes règles/API pendant un scrutin. En cas de problème, suspendre les
   mutations et appliquer un correctif. Ne jamais débloquer en éditant des résultats publiés.

Aucun déploiement, fusion ou changement de données de production n'a été effectué par cette mission.

## Limites de confiance

L'intégrité transactionnelle n'est pas le secret du vote. Les bulletins restent liés aux UID et lisibles
par le serveur/IAM ; la route de tendances administrateur subsiste (son authentification par cookie
est distincte du Bearer utilisé par les mutations). Les nouvelles ouvertures copient désormais textes
et octets des médias, indépendamment du catalogue éditorial ; les anciens scrutins sans copie restent
non figés. Voir [propositions figées, limites d'import et tests](PROPOSAL_SNAPSHOTS.md).
Les notifications post-commit peuvent être perdues.

Le hash de résultat et le HMAC du PV ne constituent pas une preuve indépendante de l'admission et
du comptage de tous les bulletins. Ils ne protègent pas contre un opérateur disposant des credentials
Admin ou du secret HMAC. Aucun protocole de vote anonyme ou vérifiable de bout en bout n'est ajouté.

## Validation

Validation de la première version (CI #87 verte), sous Node 22.16.0 et installation verrouillée
`npm ci` : lint réussi (cinq avertissements
préexistants), TypeScript réussi, 35 tests unitaires réussis, 44 tests réussis sur les véritables
émulateurs Firestore/Auth. Une recette Playwright complète réussit avec deux sessions distinctes :
administrateur et membre, ouverture, dépôt, modification, compteur, publication, résultats et PDF ;
elle vérifie aussi les trois constats sans vainqueur. Les tests de PV/verify couvrent les quatre
décisions v1 et la compatibilité du scellé v2. La CI exécute maintenant ces trois suites.
Le build production réussit également. L'avertissement Next sur `experimental.allowedDevOrigins`
est préexistant ; lint et TypeScript sont exécutés séparément puisque la configuration du build
les ignore déjà.

Dans Studio, Chromium ne disposait d'aucune police système et son moteur de rendu plantait.
La recette a réussi avec Chromium 138 et une configuration Fontconfig temporaire pointant vers
les polices Figtree du dépôt ; aucun changement produit n'a été nécessaire pour ce problème local.
Playwright utilise son navigateur installé normalement en CI. Le résultat de la CI distante figure
dans la description de PR, qui contient également les résultats du complément de copie figée et
de la revue complète. Aucune recette sur données réelles ou infrastructure de production.
Les tests sont versionnés dans `tests/vote.emulator.test.ts`, `tests/browser/vote.spec.ts`,
`src/lib/tally.reference.test.ts` et `src/lib/quorum.test.ts`.

## Trois priorités suivantes

1. Outiller les anomalies historiques et la reprise opérationnelle ; les scrutins sans copie passée
   restent non reconstructibles. Faire évoluer le stockage des archives au-delà du budget actuel
   si les projets réels le nécessitent, sans affaiblir leur immutabilité.
2. Définir le modèle de secret du vote : réduire les accès IAM et les tendances avant clôture, puis
   choisir un protocole séparant identité et bulletin si le secret face au serveur est requis.
3. Concevoir la vérifiabilité indépendante et ses preuves : admission, inclusion et dépouillement
   contrôlables, avec revue cryptographique ; un hash ou un PDF scellé seuls ne suffisent pas.

## Outillage et dépendances

Ajout verrouillé de `@firebase/rules-unit-testing@4.0.1`, `firebase-tools@15.1.0` et
`@playwright/test@1.58.2`. Leur résolution met aussi à jour neuf dépendances partagées :
`@grpc/grpc-js` 1.14.3 → 1.14.5, `protobufjs` 7.5.4 → 7.6.6, `long` 5.3.0 → 5.3.2,
`pg-protocol` 1.11.0 → 1.16.0, `zod` 3.24.2 → 3.25.76 et quatre utilitaires
`@protobufjs` (codegen/eventemitter/fetch/utf8). L'ancien graphe ne satisfaisait pas les contraintes
combinées du nouvel outillage. Le lockfile final est validé par un nouveau `npm ci` sous Node 22 ;
il ne s'agit pas d'une mise à niveau générale des dépendances ni d'un audit exhaustif de celles-ci.

L'électorat privé v1 est stocké dans un seul document : sa taille est donc limitée par Firestore.
Un dépassement fait échouer atomiquement l'ouverture ; il ne laisse pas de scrutin à moitié ouvert.
Une évolution du stockage sera nécessaire si l'électorat dépasse cette capacité.
