# Architecture du vote Ekklesia

État vérifié à partir du commit `9b529f0` et du correctif `fix/vote-integrity`.
Le [dossier de changement](VOTE_INTEGRITY.md) décrit les risques, les tests et le déploiement.

## Parcours réel

1. Un administrateur actif prépare un **brouillon** avec `CreateSessionModal` dans
   `assemblies/{assemblyId}/votes/{voteId}`. Les nouveaux documents portent `rulesVersion: 1`
   et `eligibilityPolicy: snapshot-active-v1`. Les règles n'autorisent que les champs de préparation.
2. `POST /api/admin/assemblies/{assemblyId}/votes/{voteId}/open` ouvre dans une transaction :
   aucun autre scrutin ouvert, configuration valide, aucun bulletin préexistant. Pour v1, les
   membres actifs avec rôle `member` ou `admin` constituent la liste privée
   `votes/{voteId}/electorate/snapshot.uids` et `eligibleCountAtOpen`. Liste et nombre sont figés.
   Aucun électeur : ouverture refusée. L'administrateur actif est lui-même électeur dans ce modèle.
   Toute nouvelle ouverture copie aussi les champs présentés des projets et les octets des médias
   dans `proposalSnapshots`, avec `proposalSnapshotVersion: 1` et `proposalContentHash`. La copie
   réseau précède la transaction ; celle-ci relit les versions des projets/brouillon et refuse une
   édition concurrente. Aucun snapshot n'est ajouté aux scrutins déjà ouverts ou verrouillés.
3. Le membre classe les projets puis dépose/remplace via `POST .../ballots`. Les classements
   partiels non vides sont acceptés ; les candidats omis sont également derniers. Doublons,
   identifiants étrangers et données malformées sont rejetés avant stockage.
4. La transaction relit le profil racine actif `members/{uid}`, l'assemblée, le scrutin,
   l'électorat v1 et le bulletin. Pour v1, une activation après ouverture ne permet pas de voter.
   Une suspension bloque tout nouveau dépôt ou modification, mais conserve le bulletin déjà
   enregistré et l'effectif de référence. Une réactivation d'un électeur initial autorise à nouveau
   un dépôt tant que le scrutin accepte les votes.
5. Une personne a un bulletin courant sous son UID. Le remplacement conserve `castAt` et ne
   change pas la participation. Les nouveaux scrutins datés portent `deadlineEnforced: true` :
   `closesAt` est vérifié selon l'horloge serveur pendant la transaction. Sans date, clôture manuelle.
   L'échéance refuse les dépôts mais **ne publie pas**. L'administrateur peut clôturer avant l'échéance.
6. `POST .../publish` lit/valide les bulletins, calcule Schulze et écrit **dans la même transaction**
   l'état `locked`, le classement, le constat d'adoption, le compteur, l'assemblée et `public/lastResult`.
   Tous les dépôts écrivent le document scrutin : la publication et les dépôts sont sérialisés.
   Échec avant commit : aucun changement ; répétition après commit : résultats stockés retournés
   sans recalcul. Pas d'état intermédiaire persistant à débloquer.
7. Les membres consultent `/results` et le PV, y compris sans décision adoptée. PDF et vérification
   exigent `locked`. Les notifications post-commit reprennent le constat ; leur livraison n'est pas
   garantie si le processus s'interrompt après le commit.

## Règles v1, annoncées avant ouverture

Les champs du scrutin et les versions ne sont plus modifiables après ouverture.

| Situation à la clôture | Constat | Vainqueur officiel |
| --- | --- | --- |
| Zéro bulletin, même quorum 0 % | Aucun bulletin — aucune décision adoptée | Aucun |
| Participation sous le quorum | Quorum non atteint — aucune décision adoptée | Aucun |
| Quorum atteint, plusieurs maxima Schulze | Égalité — aucun vainqueur unique ; candidats ex æquo affichés | Aucun |
| Quorum atteint, maximum Schulze unique | Décision adoptée | Candidat unique |

Le quorum utilise `bulletins * 100 >= eligibleCountAtOpen * quorumPct`, sans arrondir avant la
comparaison. Le pourcentage arrondi n'est qu'un affichage. Un futur scrutin de départage est une
nouvelle action, jamais un changement du résultat clôturé.

La clôture est `state: locked`. Le calcul est `results.fullRanking` (même rang pour les ex æquo).
L'adoption est distincte : `results.decisionStatus`, `adopted`, `winnerId` nullable,
`tiedWinnerIds`, `eligibleCount`, `quorumPct`, `quorumReached` et `rulesVersion: 1`.
Ces champs sont repris dans la copie publique et les écrans. Le classement calculé reste disponible
sans adoption. La méthode Schulze par plus forts chemins est conservée ; v1 retire le choix arbitraire
d'un identifiant comme vainqueur d'une égalité. L'ordre des noms dans un groupe ex æquo est seulement
un ordre de présentation.

## Historique

Absence de `rulesVersion` : anciennes règles conservées, y compris pour les brouillons déjà présents.
Pas de reconstruction des personnes éligibles. Le profil actif au dépôt suffit ; le nombre initial
est informatif et peut diverger de la population qui vote. Les dates indicatives restent indicatives.
Le quorum ne bloque pas le vainqueur technique, les égalités sont départagées par identifiant et une
publication sans bulletin est refusée. Ces limites sont signalées sur les résultats historiques.
Un ancien scrutin vide peut donc nécessiter une décision opérationnelle pour terminer son cycle.

Les anciens résultats verrouillés ne sont ni recalculés ni migrés. Une anomalie de bulletin lors d'une
nouvelle publication, ou un brouillon contenant déjà des bulletins, provoque un refus explicite et une
revue humaine ; aucune exclusion/nettoyage silencieux n'est effectué.

## Accès, compteurs et confiance

`members/{uid}` est l'autorité commune aux écrans et mutations serveur ; les miroirs d'assemblée
n'accordent plus de privilèges supplémentaires. Les règles interdisent toute écriture cliente des
bulletins, électorats, transitions, compteurs, résultats et copies publiques, administrateurs inclus.
Un membre actif lit son propre bulletin ; personne ne peut lister les bulletins ou lire l'électorat
privé depuis le navigateur.

`ballotCount` est partagé par les écrans. `counterVersion: 1` marque un compteur rapproché par le
serveur. Le premier dépôt d'un ancien scrutin recalcule le nombre réel dans sa transaction ; la
publication rapproche aussi le compteur. Avant rapprochement, l'interface indique « indisponible ».
Les résultats verrouillés fournissent leur total historique sans réécriture.

**Intégrité :** autorisation/validation transactionnelles, unicité, paramètres du document figés,
publication atomique et idempotente. Le SDK Admin contourne les règles : les credentials serveur et
les accès console/IAM demeurent une frontière de confiance. Le catalogue `projects` reste éditable,
mais les nouvelles ouvertures disposent d'une copie autonome des propositions et médias. Les
archives sans copie restent explicitement historiques ; aucune version ancienne n'est inventée.
Voir [formats, bornes et garanties de la copie](PROPOSAL_SNAPSHOTS.md).

**Confidentialité et secret :** les UID relient identité et bulletin côté serveur. Ce n'est pas un vote
anonyme. La route de tendances administrateur subsiste et peut révéler des préférences agrégées avant
clôture ; elle exige une session cookie, contrairement aux mutations qui acceptent aussi le Bearer.
L'annexe optionnelle `PV_INCLUDE_PSEUDOLIST` pseudonymise les UID sans anonymiser leur stockage.

**Vérifiabilité indépendante :** `resultsHash` est un SHA-256 du résultat canonique. Le HMAC du PV
(`PV_SALT`) ne signe qu'un sous-ensemble des données, pas le PDF entier ni l'exhaustivité des votes.
Les anciens scellés v2 sont conservés à l'identique. Le format v3 ajoute le constat d'adoption, les
ex æquo et la référence du quorum. Le format v4 ajoute l'empreinte du contenu et des médias figés,
sans changer les scellés v2/v3 existants. Aucune preuve indépendante d'admission/inclusion des bulletins
ni de résistance à un opérateur détenant le secret HMAC n'est fournie.

## Développement

Node 22 (`.nvmrc`, CI, Studio), Java 21, `npm ci` avec le lockfile.
`npm run lint`, `npm run typecheck`, `npm run test:run`, `npm run test:emulator`, `npm run build`.
La CI exécute les tests Auth/Firestore sur le projet fictif `demo-ekklesia-test` exclusivement.
Les contrôles TS/lint intégrés au build restent désactivés dans la configuration préexistante ; les
commandes séparées sont donc indispensables.

Recette navigateur : `npx playwright install chromium`, puis `npm run test:browser`.
Un Chromium système peut être sélectionné par `PLAYWRIGHT_CHROMIUM_EXECUTABLE`.
Playwright lance un serveur local avec `NEXT_PUBLIC_USE_FIREBASE_EMULATORS=true` ; ne jamais utiliser
ce drapeau pour un build destiné à la production. Les tests n'ont besoin d'aucune clé de production.
