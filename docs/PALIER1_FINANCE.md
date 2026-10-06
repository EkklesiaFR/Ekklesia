# Palier 1 — Contrats financiers et moteur transactionnel (Lots 1A / 1B)

Base : `64c25368eb54ec9f63e66385c5355f3803dbacdf`, après le Lot 0.
Ce lot définit des contrats validables et des fonctions pures. Il n'active aucun
paiement, fournisseur, checkout, webhook, écriture Firestore, initialisation de
cagnotte ou migration. Les collections peuvent rester entièrement vides.
Le Lot 1B, décrit plus bas, ajoute le service de persistance serveur sans l'activer
dans un parcours produit.

## Politique produit

- Cotisation obligatoire : exactement **100 centimes EUR par mois**, plan
  `monthly-1-eur-v1`, intervalle `month` uniquement.
- Aucune offre annuelle, aucun paiement anticipé de 12 euros.
- Soutien supplémentaire libre, comptabilisé séparément. Pour le Palier 1,
  **cotisations et soutiens alimentent la même cagnotte**, `common_fund`.
- Donner davantage ne donne jamais davantage de voix. Ces modules n'offrent
  aucune fonction de calcul de droit de vote et ne sont pas importés par le vote.
- `members/{uid}` reste seul responsable du profil, rôle et état administratif.
  Aucun changement de `disabled`, `blocked`, `revoked` ou de l'électorat.

## Collections et responsabilités

| Collection | Rôle | Source des montants officiels du fonds ? |
| --- | --- | --- |
| `memberships/{uid}` | État économique et période acquise d'adhésion | Non |
| `payments/{paymentId}` | Une opération économique, ventilation et état | Non |
| `paymentEvents/{eventId}` | Métadonnées d'une livraison fournisseur future | Non |
| `financialLedger/{operationId}` | Faits financiers validés, append-oriented | **Oui, exclusivement** |
| `fundPeriods/{YYYY-MM}` | Projection mensuelle reconstructible du journal | Non, jamais éditable comme autorité |
| `financeOperationKeys/{keyHash}` | Réservation transactionnelle des clés (Lot 1B) | Non |
| `financeState/current` | Projection courante et sérialisation des opérations (Lot 1B) | Non |

Un paiement peut être décrit par plusieurs événements et produire plusieurs
écritures : cotisation, soutien et frais. La projection ne doit additionner ni
`payments` ni un hypothétique champ global `fundAmount` au journal.

## Organisation et timestamps

- `src/lib/membership/types.ts` : schéma Zod et type `Membership`.
- `src/lib/finance/types.ts` : `Payment`, `PaymentEvent`, `FundPeriod`, `FundBalances`.
- `src/lib/finance/values.ts` : primitives validées, centimes sûrs, UTC et calendrier Paris.
- `src/lib/finance/ledger.ts` : types, validation, construction et reconstruction du journal.
- `src/lib/finance/periods.ts` : bornes des mois et projection pure.

Les schémas stricts refusent les champs inconnus, les versions/devises inconnues et
les valeurs monétaires invalides. Aucune dépendance nouvelle, React, réseau ou SDK
Firebase d'exécution dans ces fonctions.

`TimestampValue` est le contrat structurel `{ seconds, nanoseconds }`, compatible
avec les valeurs Timestamp des SDK client et Admin. Les fonctions de calendrier
retournent des valeurs UTC de ce contrat, sans perte de la précision nanoseconde
pour les comparaisons. Dates JavaScript et chaînes ISO ne sont pas des Timestamp
valides. Les futures couches de persistance devront convertir ces valeurs en
**vrais Timestamp Firestore**, pas les écrire comme de simples maps. Cet adaptateur
et la persistance appartiennent au Lot 1B. Aucun placeholder serverTimestamp n'est
accepté par une fonction de reconstruction : elle attend des faits horodatés résolus.

## Adhésion indépendante du compte

Statuts économiques : `pending_payment`, `active`, `past_due`, `expired`.
Rôle et suspension ne sont pas des champs de ce contrat.

La cotisation est fixée à 100 centimes et l'intervalle à `month`. Une adhésion en
attente peut n'avoir aucune période payée. Les bornes, lorsqu'elles sont présentes,
sont fournies ensemble et ordonnées. `active` exige une période et `paidThrough`
couvrant cette période. Aucun calcul d'état par horloge n'est ajouté ici.

`cancelAtPeriodEnd: true` reste compatible avec `status: active` : une demande
d'annulation ne retire pas la période acquise. Le renouvellement, les échéances,
la grâce et les transitions liées à un fournisseur restent à concevoir au Lot 2.
Les périodes individuelles d'adhésion ne sont pas assimilées aux mois civils du fonds.

## Paiements et événements

Tous les montants sont des entiers sûrs en centimes, positifs ou nuls pour Payment :

```text
membershipAmountMinor ∈ {0, 100}
supportAmountMinor >= 0
membershipAmountMinor + supportAmountMinor = grossAmountMinor (avant frais)
0 <= refundedAmountMinor <= grossAmountMinor
```

Zéro en part cotisation permet un soutien seul ; une cotisation est toujours 100.
Le brut est strictement positif, même pour un soutien seul. Un paiement sans
cotisation ne porte aucune borne de période d'adhésion. `confirmedAt` est obligatoire
pour confirmed/partially_refunded/refunded et interdit pour pending/failed.
Les frais sont distincts du brut et du remboursement ; leur montant n'est pas
arbitrairement plafonné au brut. Un paiement confirmed/partially_refunded/refunded
requiert `confirmedAt` et, pour une cotisation, sa période. Les remboursements
partiels et totaux doivent correspondre au statut ; aucun remboursement sur un
paiement encore pending/failed/confirmed. Ces contrôles ne prouvent pas qu'un
prestataire a encaissé : seul un futur traitement serveur fiable pourra le confirmer.

PaymentEvent conserve identifiants/type/dates/état de traitement, un hash SHA-256
facultatif du payload et un code d'erreur facultatif. Aucun payload brut, donnée
bancaire ou champ de carte n'est défini. Le hash d'événement n'est ni une signature
fournisseur ni une chaîne de hashes du journal. Aucun webhook n'existe dans ce lot.

## Journal v1 et calcul du fonds

`amountMinor` est strictement positif et sûr ; les deltas sont signés et sûrs.
`createLedgerEntry` calcule les deltas ; fournir ses propres deltas à cette fonction
est refusé. `ledgerEntrySchema` vérifie aussi les deltas d'une entrée déjà construite.
La cotisation ledger vaut exactement 100 centimes par opération.

Les références métier sont obligatoires et validées à la construction comme à la
lecture d'une entrée : `membership_payment` exige `uid` et `paymentId` ;
`extra_support`, `payment_fee` et `refund` exigent `paymentId` ;
`project_commitment`, `project_commitment_release` et `project_payout` exigent
`projectId` et `awardId`. Une contre-écriture conserve exactement les références
de son original, y compris l'absence des références facultatives. Ces validations
ne prouvent pas l'existence des documents référencés ; ce contrôle reste au service
transactionnel du Lot 1B.

| Type | Variation cash | Variation engagements |
| --- | ---: | ---: |
| membership_payment | +montant | 0 |
| extra_support | +montant | 0 |
| payment_fee | -montant | 0 |
| refund | -montant | 0 |
| project_commitment | 0 | +montant |
| project_commitment_release | 0 | -montant |
| project_payout | -montant | -montant |

```text
cashMinor       = somme des cashDeltaMinor
commitmentMinor = somme des commitmentDeltaMinor
availableMinor  = cashMinor - commitmentMinor
```

Exemple : cotisation 100 + soutien 500 - frais 25 = cash 575.
Un engagement de 300 laisse cash 575, engagements 300 et disponible 275.
Le versement de 300 laisse cash 275, engagements 0 et **disponible toujours 275**.
L'engagement et le versement ne retirent pas deux fois la somme disponible.

`calculateFundBalances` reçoit uniquement des `LedgerRecord`, c'est-à-dire
l'identifiant du document et son `LedgerEntry`. Aucun solde initial externe.
La somme est réalisée avec bigint en mémoire, puis ramenée à un number sûr : pas
de flottants monétaires, pas de bigint persisté, dépassement de capacité refusé,
résultat indépendant de l'ordre des entrées. Un historique vide produit zéro dans
le calcul pur ; cela n'écrit ni n'affiche une cagnotte fictive.

Une balance négative est restituée, pas masquée par un plancher à zéro. Les contrôles
d'autorisation, de disponibilité, de paiement maximal et de libération d'engagement
par projet appartiendront aux commandes transactionnelles du Lot 1B. Un calcul
purement arithmétique n'est pas une autorisation de dépense.

## Ajustements et contre-écritures

Un `manual_adjustment` exige un `reason` non vide et une cible explicite
`cash`, `commitment` ou `cash_and_commitment`, ainsi qu'une direction
`increase`/`decrease`. Les deltas découlent de ce choix et du montant ; il n'existe
pas deux deltas libres. Ce contrat n'accorde aucun privilège : une future commande
serveur devra vérifier l'administrateur autorisé, le motif et les justificatifs.
Aucune UI ni route d'ajustement dans ce lot.

`createReversal` produit un nouvel ajustement avec `reversalOf`, montant identique,
deltas exactement opposés et mêmes références membre/paiement/projet/award. Il
n'altère pas l'original. Une contre-écriture ne peut précéder la date effective de
son original. La reconstruction refuse une référence absente, soi-même, une seconde
contre-écriture du même original ou des deltas/références incompatibles.

Choix v1 : contre-écriture intégrale uniquement ; pas de chaîne « annulation d'une
annulation ». Une correction supplémentaire doit être un nouvel ajustement explicite.
Un remboursement partiel reste une opération `refund`, pas une contre-écriture
partielle. Aucune hash-chain, blockchain ou séquence globale n'est introduite.

## Périodes financières Paris

`fundPeriodBounds` détermine le mois civil en `Europe/Paris` avec Intl/tzdata,
sans coder en dur CET/CEST. Intervalle semi-ouvert : `[startsAt, endsAt)` en UTC.
Exemples testés : mars 2026 commence le 28 février à 23 h UTC et termine le
31 mars à 22 h UTC ; octobre termine le 31 octobre à 23 h UTC. Les années
bissextiles, changements d'année et frontières à la nanoseconde sont testés.

`periodId` d'une écriture correspond à son `effectiveAt` en Paris ; `recordedAt`
reste la date d'enregistrement, qui peut être ultérieure. Une correction comptable
porte sa propre date effective. Aucun événement historique n'est réécrit.
Les dates doivent rester représentables par Firestore ; une borne hors plage est
refusée, notamment la fin du mois de décembre 9999.

`projectFundPeriod` reçoit l'historique complet et un `calculatedAt` explicite :
- ouverture = sommes de toutes les écritures antérieures au mois ;
- clôture = ouverture + variations du mois ;
- catégories = cotisations, soutiens, frais, remboursements, engagements créés/libérés et versements ;
- deux champs signés supplémentaires, `cashAdjustmentsMinor` et
  `commitmentAdjustmentsMinor`, rendent les corrections et contre-écritures visibles ;
- disponible = clôture cash - clôture engagements.

Les totaux de FundPeriod sont validés contre cette égalité, y compris les ajustements.
Pour vérifier les références de contre-écriture, il faut fournir l'historique complet,
pas seulement les entrées du mois. Les doublons sont refusés explicitement.
Une écriture arrivée tardivement imposera une reconstruction des périodes concernées
et des reports suivants. Le moteur transactionnel/incrémental est au Lot 1B.

## Idempotence future

Deux niveaux distincts devront être atomiquement protégés côté serveur :
1. livraison fournisseur : paire provider/externalEventId ;
2. opération économique : clé métier stable, y compris composante cotisation/soutien/
   frais/remboursement. Plusieurs événements peuvent décrire le même paiement.

Le journal porte `idempotencyKey`, sourceType/sourceId et les références pertinentes.
La fonction de reconstruction refuse les doublons d'ID ou de clé plutôt que les
compter deux fois. Elle ne remplace pas l'unicité persistante : réservation des clés,
écritures transactionnelles, reprise après panne et contrôle des événements hors
ordre sont à implémenter plus tard. Aucun document de déduplication ni appel bancaire
n'est créé par ce lot. Un transfert prestataire vers banque ne doit pas être réimporté
comme une nouvelle recette ; son traitement nécessitera un contrat ultérieur explicite.

## Sécurité Firestore

| Collection | Client membre | Client admin | Serveur Admin SDK |
| --- | --- | --- | --- |
| memberships | get de son seul UID ; aucune liste/écriture | idem, son seul document | futures écritures autorisées par le service |
| payments | aucun accès | aucun accès | futur service |
| paymentEvents | aucun accès | aucun accès | futur service |
| financialLedger | aucun accès | aucun accès | futur service |
| fundPeriods | aucun accès | aucun accès | futur service |
| financeOperationKeys | aucun accès | aucun accès | moteur du Lot 1B |
| financeState | aucun accès | aucun accès | moteur du Lot 1B |

L'accès au membership dépend du chemin du document, jamais du champ uid reçu.
Un compte pending peut lire sa propre adhésion sans être déjà adhérent.
Aucune lecture publique et aucune projection publique ; l'historique utilisateur
passera éventuellement par une API dédiée. La page Cagnotte reste au Lot 3.

Les règles ne protègent pas contre Admin SDK/IAM : les futurs services doivent
valider les contrats et leurs autorisations. Les entrées validées devront être
append-only au niveau du service, avec correction par nouvelle entrée. Pas de
promesse de WORM face à un opérateur privilégié.

## Validation et décisions différées

Tests unitaires : contrats/plans, montants invalides, ventilation/remboursements,
annulation d'adhésion, mapping de toutes les opérations, engagement/versement,
libération, contre-écritures, doublons, overflow, période Paris et reports.
Tests Emulator : toutes les mutations financières refusées aux membres et admins,
lecture de son seul membership, lectures publiques et listes financières refusées.
Les suites de vote existantes sont conservées sans modification.

Restent à préciser dans les lots suivants : persistance/idempotence transactionnelle,
politique de justificatifs/autorisation des ajustements, convention des périodes
individuelles de souscription, état de grâce/échec, disponibilité des fonds, choix du
prestataire et frais exacts. Aucun de ces choix ne doit introduire d'offre annuelle.
Le lien entre cotisation et droit de vote est expressément hors de ce lot.

### Résultats de recette du Lot 1A

- Lint : réussi, cinq avertissements préexistants dans des fichiers inchangés.
- TypeScript : réussi.
- Unitaires : 123 réussis (74 nouveaux), dix fichiers, incluant les durcissements
  de revue sur les références métier et les états Payment.
- Auth/Firestore Emulator : 76 réussis (dix nouveaux), trois fichiers ; suites
  projets et vote existantes incluses, sur demo-ekklesia-test uniquement.
- Build : réussi ; avertissement préexistant experimental.allowedDevOrigins.
- Playwright vote existant : réussi, un scénario complet, 2,5 minutes au total.

La recette navigateur utilise Chromium système 138 et une configuration Fontconfig
temporaire vers les polices Figtree du dépôt, comme la recette précédente. Les accès
navigateur hors localhost sont bloqués par le test existant. Aucun test du vote ni
aucune configuration produit n'a été modifié pour cette recette.

Revue du diff : tous les blocs de règles préexistants sont conservés octet pour
octet. Aucun fichier existant du vote, de l'UI, de l'authentification ou des dépendances
n'est modifié. Aucune donnée de production lue/écrite et aucun déploiement.

## Lot 1B — Moteur transactionnel serveur

Base : `fcca4a884a3bf06b77d6c8754b8d12534f1a0d92`. Ce lot ajoute uniquement
un service serveur, sans API, UI, fournisseur, checkout, webhook ni déploiement.
Il ne touche pas au vote. Les tests utilisent exclusivement les émulateurs du
projet `demo-ekklesia-test`.

### Organisation et appel

Tous les modules de `src/lib/server/finance/` importent `server-only` :

- `finance-service.ts` : autorisation, commandes, transaction, contrôles métier ;
- `firestore-values.ts` : conversions explicites entre TimestampValue et Timestamp Admin ;
- `idempotency.ts` : SHA-256 et sérialisation canonique ;
- `projections.ts` : mise à jour incrémentale des mois ;
- `errors.ts` : erreurs métier identifiables par `FinanceError.code`.

`applyFinanceOperation(db, command, actor)` ouvre une transaction Admin SDK.
`applyFinanceOperations` traite un lot ordonné de commandes, toutes avec des clés
distinctes et le même acteur. Les deltas sont exclusivement calculés par les
fonctions du Lot 1A. `createdBy`, `recordedAt` et les deltas fournis par l'appelant
sont refusés. Le service fournit sa date d'enregistrement.

La transaction lit d'abord l'état, les autorisations, les clés, les références,
les historiques d'award concernés et les projections ; ensuite seulement elle
écrit. Aucune requête réseau extérieure ni notification dans son callback.
Une exception annule aussi la réservation de clé et toutes les projections.

Pour le Lot 2, `prepareFinanceOperations(tx, db, commands, actor)` permet de
préparer **toutes** les commandes financières dans une transaction déjà ouverte.
Le résultat contient `results` et `write()` ; la préparation ne fait aucune écriture.
Le futur orchestrateur pourra effectuer ses autres lectures, puis écrire Payment
et appeler `write()` dans la même transaction. Il doit appeler la préparation une
seule fois par transaction, avec l'ensemble des commandes financières, et ne jamais
écrire avant d'avoir terminé ses lectures. `write()` n'est utilisable qu'une fois.
Aucune transaction imbriquée n'est nécessaire. Les résultats ne deviennent définitifs
qu'après le succès de la transaction extérieure.

### Acteur et références

`FinanceActor` représente une capacité construite par du code serveur fiable,
jamais un objet accepté tel quel depuis un client :

- `system` avec un nom de service non vide : cotisation, soutien, frais, remboursement ;
- `admin` avec un UID : engagement, libération, versement, ajustement et reversal.

Pour un admin, `members/{uid}` est relu dans chaque transaction, même sur replay :
seuls `role: admin` et `status: active` autorisent l'opération. Le service déduit
l'auteur (`system:{service}` ou `admin:{uid}`) ; une assertion `isAdmin` est refusée.
L'authentification du futur orchestrateur, le traitement fournisseur et la légitimité
d'une commande système ne sont pas inventés dans ce lot.

Si un Payment référencé existe, son contrat et ses Timestamp sont validés ; un UID
porté par l'entrée doit correspondre au Payment. L'absence de Payment reste permise,
comme demandé pour ce socle. Le service ne prétend pas confirmer un encaissement,
ni imposer encore les plafonds cumulés des composantes/remboursements d'un Payment.
Le futur orchestrateur devra valider le nouveau Payment et ses commandes ensemble,
y compris lorsqu'il crée le Payment dans la transaction extérieure.

### Réservation et retries

`financeOperationKeys/{SHA256(idempotencyKey)}` contient :
`schemaVersion`, `idempotencyKey`, `requestHash`, `operationId`, `createdAt`.
L'ID ledger est déterministe : `finance_{SHA256(idempotencyKey)}`.
Les clés peuvent contenir des caractères impropres à un ID Firestore ; aucun
remplacement de caractères ni troncature ne crée d'alias.

La commande est d'abord validée/normalisée par les contrats. Son hash canonique
inclut l'auteur dérivé, les références, le montant, le type, la date effective et
les métadonnées de source/motif ; il exclut `recordedAt`, généré à chaque tentative.
Les clés d'objet sont triées et les nanosecondes font partie de la représentation.

- Clé absente : création de la clé **et** du ledger, mise à jour de l'état et des mois
  dans une seule transaction. Le ledger utilise uniquement `tx.create`.
- Même clé/même hash : retour du même ID et de l'entrée persistée, `replayed: true` ;
  aucun nouvel effet et aucune mise à jour des dates de projection.
- Même clé/autre hash : `IDEMPOTENCY_CONFLICT`, aucune écriture.
- Clé ou ID déjà incohérent avec le ledger : `RECONSTRUCTION_REQUIRED` ; aucun overwrite.

Une réponse perdue après commit se traite par le même replay, sans nouvelle entrée.
Le SDK peut réexécuter le callback sous contention (jusqu'à dix tentatives dans le
wrapper) ; le même ID est utilisé. Une contention qui épuise les retries reste une
erreur technique à renvoyer, et la commande peut être soumise à nouveau avec sa clé.
SHA-256 offre une résistance pratique aux collisions, pas une preuve mathématique
d'absence de collision ; la clé originale est vérifiée dans le document réservé.

### État courant et concurrence

`financeState/current` est une projection privée : `schemaVersion`, `currency`,
`cashMinor`, `commitmentMinor`, `availableMinor`, `updatedAt`, `lastOperationId`.
Toujours `availableMinor = cashMinor - commitmentMinor`, avec calculs intermédiaires
bigint et refus des dépassements d'entiers sûrs. **Le ledger reste l'autorité.**

Chaque nouvelle opération lit et écrit le même document d'état dans sa transaction.
Cela sérialise les vérifications de financement, y compris la première opération :
deux engagements simultanés de 700 pour 1 000 disponibles ne peuvent réussir ensemble.
Un état absent ne peut être initialisé à zéro que si le ledger et les projections
mensuelles sont réellement vides. Sinon : `RECONSTRUCTION_REQUIRED`.

Les engagements exigent le disponible ; les libérations et versements ne peuvent
excéder l'encours de l'award. Un versement exige aussi la trésorerie et diminue cash
et engagements du même montant : le disponible réservé reste inchangé.
Une opération projet normale est refusée si son état résultant reste négatif.
Les débits système et corrections exceptionnelles peuvent exposer un déficit,
conformément aux calculs du Lot 1A ; ce déficit n'est jamais masqué.

L'encours d'un award est obtenu par une requête sur **son** historique ledger,
incluant les contre-écritures et les corrections portant cet award : somme des
`commitmentDeltaMinor`, donc engagements moins libérations et versements.
Un award reste lié au même projet, même lorsque son encours est revenu à zéro.
Une correction portant un award doit porter aussi son projet et ne peut rendre
son encours négatif. Aucun `projectAwards` n'est créé : l'existence du futur Award
métier sera validée au Lot 5.

### Mois et opérations rétroactives

Le service lit les mois matérialisés, valide leurs contrats et leurs enchaînements,
puis les rapproche de l'état courant. Il ne reconstruit pas tout le ledger à chaque
paiement. Lors de la création d'un mois, la clôture du mois précédent le plus récent
sert d'ouverture ; à défaut, zéro. Une requête bornée d'existence vérifie qu'aucun fait
antérieur non projeté ne se cache dans l'intervalle manquant. Aucun montant simulé de
l'UI n'est utilisé.

Une opération du mois M ajoute ses catégories uniquement à M, puis ses deltas aux
soldes d'ouverture et de clôture des mois ultérieurs déjà matérialisés. Ces derniers
conservent leurs propres catégories. Un mois intermédiaire encore absent peut être
créé ultérieurement à partir de la dernière clôture précédente. Toutes ces écritures
sont atomiques avec le ledger et l'état courant.

Toutes les commandes, y compris les ajustements et reversals, exigent
`effectiveAt <= recordedAt` (instant serveur de la tentative transactionnelle).
La comparaison utilise secondes et nanosecondes, avant toute préparation
économique : une date strictement future, même de 1 ns, produit `INVALID_COMMAND`
sans réservation de clé, écriture ledger ni changement d'état ou de période.
L'égalité avec l'instant serveur est acceptée. Les opérations rétroactives restent
autorisées ; aucune recette future ne peut être rendue disponible immédiatement.

### Corrections, reconstruction et limites

Un ajustement exige un admin actif, un motif et une source explicites. Une reversal
utilise une commande dédiée (`operationType: reversal`, `reversalOf` et les métadonnées
propres à la correction) ; le service relit l'original et utilise `createReversal`.
Il conserve exactement les références, refuse les chaînes et les doubles reversals,
et inclut les contre-écritures dans l'encours. Fournir directement `reversalOf` sur
un ajustement ordinaire est interdit. Aucune entrée existante n'est modifiée/supprimée.

Les conversions créent de vrais Timestamp Admin pour chaque champ de date persisté,
sans passage par millisecondes. La lecture refuse les simples maps. Firestore natif
[tronque à la microseconde](https://firebase.google.com/docs/firestore/manage-data/data-types) :
l’adaptateur conserve les 0 à 999 nanosecondes restantes dans une métadonnée technique
facultative `timestampRemainders` (par nom de champ). Les champs de date restent de
vrais Timestamp, jamais des maps seconds/nanoseconds. La lecture valide et retire cette
métadonnée pour restituer exactement le contrat Lot 1A, préserver les comparaisons et
garder le hash de replay stable. Les requêtes temporelles Firestore ont la précision
native microseconde ; les bornes mensuelles, alignées à la seconde, restent exactes.

`RECONSTRUCTION_REQUIRED` bloque les nouvelles écritures en présence d'un état,
d'une clé ou de projections détectés incohérents. La remise en état doit être une
opération de maintenance serveur explicite et contrôlée, utilisant `validateLedger`,
`calculateFundBalances` et `projectFundPeriod` sur l'historique complet. Ce lot ne
propose pas de réparation automatique ni de migration ; les clés d'idempotence
ne doivent jamais être supprimées pour contourner un conflit.

Limites : un document d'état commun constitue un point de contention assumé pour
ce palier ; lecture des mois matérialisés et de l'historique des awards concernés ;
maximum de 100 commandes par lot et de 450 écritures financières préparées. Une
opération rétroactive dépassant ce budget échoue avant écriture et exige une stratégie
de maintenance ultérieure. Les contrôles courants ne garantissent pas qu'un solde
historique de chaque instant était financé : les opérations rétroactives s'appuient
sur la disponibilité actuelle. Les projections restent reconstructibles, pas une
preuve cryptographique du journal. Un opérateur Admin SDK/IAM peut contourner le
service ; aucun WORM ni audit exhaustif à chaque opération n'est promis.

Les nouvelles collections `financeOperationKeys` et `financeState` refusent toute
lecture/écriture cliente, navigateur admin compris. Les blocs de règles précédents
sont conservés. Le Lot 1B n'expose aucun endpoint public ni commande de reconstruction.

### Recette du Lot 1B

- Lint et typecheck : réussis ; cinq avertissements lint préexistants, aucun nouveau.
- Unitaires : 132 réussis dans onze fichiers, dont neuf nouveaux tests serveur.
- Auth/Firestore Emulator : 139 réussis dans quatre fichiers, dont 63 tests du
  moteur transactionnel ; suites projets/vote existantes conservées.
- Build : réussi ; avertissement `experimental.allowedDevOrigins` préexistant.
- Playwright vote existant : un scénario complet réussi (2,6 minutes), sans
  modification du test, avec Chromium système et Fontconfig temporaire local.

Les tests de concurrence inspectent les écritures avant tout retry explicite.
Seuls ABORTED et le diagnostic exact de transaction expirée de l'Emulator sont
rejoués ; le retry d'une commande non finançable doit produire le refus métier,
pas être accepté comme un simple échec technique.

## Lot 1C — Cagnotte et registre publics en lecture

La page officielle de transparence financière est `/cagnotte`. La card
`CommunityFundCard` affiche le disponible réel et mène à cette page avec
« Voir le registre → ». Aucun solde simulé n'est utilisé. Pendant le chargement,
aucun montant n'est affiché ; une indisponibilité ne devient jamais un zéro.

`GET /api/public/finance` appelle exclusivement le service serveur Admin SDK
`readPublicFinance`. Le module est protégé par `server-only`. Une transaction
Firestore **read-only** lit un instantané cohérent de `financeState/current`, du
journal et de l'existence des périodes. Elle n'écrit aucun document et ne réserve
aucune clé d'idempotence. Le contrat d'état du Lot 1B est partagé sans modifier
ses validations ni le comportement du moteur transactionnel.

- `empty` : état absent, journal vide **et** périodes vides ; soldes à zéro,
  total versé à zéro, registre vide. La lecture n'initialise pas la base.
- `active` : contrat de l'état validé, avec `availableMinor = cashMinor - commitmentMinor` ;
  les trois soldes retournés sont ceux de la projection serveur réelle.
- `unavailable` (HTTP 503) : état absent avec un historique, contrat invalide,
  journal invalide ou erreur d'infrastructure. Aucun montant de remplacement,
  détail technique ou erreur privée n'est retourné.

La réponse utilise une liste explicite de champs publics. Chaque mouvement
contient uniquement une date effective UTC, une catégorie publique, le
`publicLabel` facultatif (sinon `null`) et un montant signé en centimes EUR.
La date restitue les nanosecondes via l'adaptateur existant. Le tri est décroissant
par date effective : une opération rétroactive apparaît à sa date économique.
Les libellés sont rendus comme texte, sans HTML. Un `publicLabel` doit être rédigé
pour publication par les futurs producteurs serveur ; aucune raison privée de
correction n'est utilisée comme libellé de remplacement.

Les catégories distinguent cotisation, soutien, frais, remboursement, engagement,
libération d'engagement, versement, correction et annulation. Les frais,
remboursements, versements et libérations sont négatifs ; les corrections suivent
leur direction. Ces montants décrivent les mouvements de leur catégorie et ne
doivent pas être additionnés pour déduire le disponible (un engagement n'est pas
un mouvement de trésorerie). Le total versé est la somme des versements projet,
diminuée de leurs reversals validées ; les corrections génériques ne sont pas
reclassées arbitrairement en versements.

Aucun `uid`, `paymentId`, `awardId`, `projectId` interne, `idempotencyKey`,
`sourceId`, `createdBy`, motif privé, identifiant d'opération ou donnée fournisseur
n'est exposé. L'enrichissement par un projet public reste différé. L'API est
accessible sans authentification et désactive le cache HTTP ; les collections
financières restent inaccessibles directement depuis les clients. Les règles
Firestore et le moteur de vote ne changent pas.

Limites : cette première lecture parcourt le journal complet pour fournir un
registre complet et un total versé exact, annulations comprises. Elle n'est pas
une reconstruction des soldes ni une réparation automatique. Une pagination du
registre et une projection dédiée du total versé seront nécessaires si le volume
augmente ; elles devront conserver la cohérence de l'instantané. Aucun contrôle
exhaustif de rapprochement des soldes avec le journal n'est ajouté à cette route.

Aucun paiement réel, checkout, webhook, bouton payer, prestataire ni endpoint
d'écriture financière n'est ajouté. Toutes les fixtures financières de recette
sont strictement locales, sur le projet `demo-ekklesia-test` avec les Emulators.

### Recette du Lot 1C

- Lint et typecheck : réussis ; cinq avertissements lint préexistants.
- Unitaires : 135 tests réussis dans douze fichiers, dont trois tests du contrat public
  et du format monétaire exact jusqu'à la limite des entiers sûrs.
- Auth/Firestore Emulator : 150 tests réussis dans cinq fichiers, dont onze nouveaux
  cas de lecture : base vide, chiffres exacts, cohérence du disponible, historique
  sans état, contrats invalides, absence de champs privés et annulation d'un versement.
  Les snapshots économiques restent strictement inchangés après les lectures vérifiées.
- Build : réussi ; avertissement `experimental.allowedDevOrigins` préexistant.
- Playwright : trois scénarios réussis, dont la card cliquable et la page vide,
  l'indisponibilité sans faux zéro, et le parcours vote existant inchangé.
  La fixture membre du test de card est nettoyée après chaque scénario pour
  ne pas modifier l'électorat du scénario vote suivant.
