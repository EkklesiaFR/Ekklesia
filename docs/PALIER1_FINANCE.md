# Palier 1 — Contrats financiers (Lot 1A)

Base : `64c25368eb54ec9f63e66385c5355f3803dbacdf`, après le Lot 0.
Ce lot définit des contrats validables et des fonctions pures. Il n'active aucun
paiement, fournisseur, checkout, webhook, écriture Firestore, initialisation de
cagnotte ou migration. Les collections peuvent rester entièrement vides.

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
