# Propositions figées à l'ouverture

## Frontière corrigée

Avant ce complément, `openVote` figeait seulement des identifiants. `/vote`, les résultats,
l'administration, la carte du dernier résultat et les tendances relisaient `/projects` ; publication
relisait même le titre gagnant. `imageUrl` et `links` pouvaient pointer vers des objets remplacés ou
supprimés à URL constante. Une copie de ces URL n'aurait donc pas corrigé le problème.

Toute ouverture après ce correctif, y compris celle d'un brouillon existant, copie titre, résumé,
description longue, budget, nom/bio du porteur, illustration et pièces jointes. Les coordonnées
privées, UID, statut éditorial et dates du catalogue ne sont pas copiés. `proposalSnapshotVersion: 1`
est indépendant de la version des règles électorales : aucune règle ancienne n'est réinterprétée.

## Octets, pas références modifiables

Les octets sont intégrés sous forme de `data:` base64 dans le document scrutin lui-même, avec type,
taille et SHA-256 par média. Il n'y a aucun objet Storage à maintenir ou URL d'origine à recharger.
Remplacer/supprimer une image distante, un avatar Storage utilisé comme source ou le projet original
n'affecte plus la copie. Les règles Firestore interdisent déjà toute modification du scrutin ouvert,
y compris ces champs, même à un administrateur navigateur. Le serveur/IAM reste une autorité de
confiance : ce n'est pas un stockage WORM protégeant contre l'opérateur de la plateforme.

Les images acceptées sont PNG, JPEG et WebP ; les pièces téléchargeables acceptent aussi PDF.
Le type est détecté sur les octets, sans faire confiance au Content-Type distant. Aucune page HTML,
SVG, vidéo ou site web n'est importé ; les liens doivent désigner une pièce statique prise en charge.
Leurs contenus ne sont jamais supprimés silencieusement : l'ouverture échoue avec une explication.
Le PDF est conservé comme fichier exact, pas exécuté ni exploré : ses éventuels liens externes ne
sont pas archivés récursivement. Les textes sont affichés comme texte, pas comme HTML interprété.

Import réseau : HTTPS sans identifiants ni port personnalisé ; hôtes exacts `images.unsplash.com`,
`placehold.co`, `picsum.photos`, `fastly.picsum.photos`, `firebasestorage.googleapis.com`,
`storage.googleapis.com`. Chaque redirection est validée avant requête, au plus trois redirections,
15 secondes par média, 60 secondes pour l'import complet, au plus 20 médias et 512 Kio de réponse
par média (contrôle du flux). Le budget global de taille est débité après chaque texte/pièce et
partagé entre tous les projets, avant de télécharger la pièce suivante. Les sources `data:`
acceptées sont également bornées et validées. Aucun proxy URL générique n'est ajouté.

Limite initiale : **800 Kio pour l'ensemble des propositions sérialisées**, base64 inclus, pour
laisser une marge sous la limite Firestore du document. Trop volumineux, absent, non pris en charge
ou inaccessible : ouverture refusée sans aucun état partiel. Réduire explicitement les pièces ou
préparer une évolution du stockage avant d'ouvrir ; aucune compression/remplacement automatique
ne modifie la proposition. Cette solution bornée évite un cycle de vie de fichiers séparé ; les
écoutes du scrutin transfèrent aussi ces octets, ce qui limite les gros scrutins et augmente le trafic.

## Atomicité, consommateurs et historique

L'administrateur est vérifié avant l'import. Après préparation, la transaction relit son profil, le
brouillon et tous les projets : un changement de version ou une suppression depuis la préparation
annule l'ouverture. La transaction écrit copie, électorat, compteurs et état d'assemblée ensemble.
Les téléchargements ne sont pas rejoués à chaque retry Firestore. Une interruption avant commit
ne laisse aucun fichier orphelin ni état intermédiaire. Une ouverture répétée ne recopie rien.

`projectsForVote` fournit exclusivement le snapshot si une version existe : aucun secours vers le
catalogue courant en cas de copie manquante. Dépôt et publication vérifient l'empreinte. Le vote et
le détail des résultats proposent la fiche complète et le téléchargement des pièces copiées ; les
listes, cartes, admin et tendances prennent aussi leurs libellés/images dans cette version.
Le catalogue `/projects` et les projets mis en avant sur l'accueil restent un catalogue courant,
distinct des propositions d'un scrutin.

Publication enrichit le classement avec les titres figés, reprend le titre gagnant sans relire
l'original et inclut l'empreinte du contenu dans le résultat canonique. Le PV et sa vérification
ajoutent cette empreinte au format HMAC v4. Les formats v2/v3 et résultats déjà publiés ne changent
pas. Le hash ne prouve ni la sincérité de l'opérateur ni l'exhaustivité du comptage.

Les scrutins déjà ouverts/verrouillés sans snapshot ne sont **jamais reconstruits**. Leur interface
avertit que les informations du catalogue peuvent avoir changé ; une suppression peut les rendre
indisponibles. Leurs résultats et scellés restent ceux de l'historique.

## Déploiement — non exécuté

Respecter la fenêtre de suspension décrite dans [le dossier de vote](VOTE_INTEGRITY.md) : application,
retrait des anciennes instances et requêtes en vol, règles restrictives, recette, réouverture.
La PR n'étant pas encore déployée, appliquer application et règles de l'ensemble de la PR. Aucune
migration ou règle Storage supplémentaire n'est nécessaire : les médias figés résident dans le
document Firestore. Recharger les clients avant toute nouvelle ouverture ; les anciens clients
relisent le catalogue. Examiner en préproduction les formats/tailles des projets avant la bascule.
Les scrutins déjà ouverts conservent leur contenu non archivé et leurs règles antérieures.

## Preuves

Tests unitaires : sources et redirections dangereuses refusées, formats/tailles, copie des octets,
hash canonique, absence de repli live, compatibilité v3 et engagement du contenu en v4.
Émulateur : modification/suppression de tous les originaux et indisponibilité de leur source média
après ouverture, stabilité jusqu'à publication/PV, édition/suppression concurrente pendant import,
suspension admin pendant import, refus des copies clientes, corruption détectée, échec puis reprise,
absence de backfill historique. Les réponses réseau sont contrôlées dans ces tests ; Firestore et
ses transactions/règles utilisent le vrai émulateur. Playwright vérifie la fiche, l'image et le
téléchargement copiés après suppression des originaux, pendant vote puis dans les résultats.

Les résultats des commandes et de la revue complète figurent dans la PR #43.

## Revue critique du diff complet

Relecture des changements depuis `9b529f0`, complétée par une revue indépendante en lecture seule :
contrôles Bearer/session et profil racine, règles des états/compteurs/résultats, électorat initial et
suspensions, échéance, classement partiel, quorum/égalité/zéro bulletin, sérialisation des dépôts,
publication/assemblée et reprise, toutes les copies de libellés, PV/scellés et configuration de test.
Les champs protégés ne sont modifiables ni via brouillon forgé ni via copie publique ou miroir.
L'absence de garantie de livraison des notifications, les privilèges Admin/IAM et les limites de
confidentialité/vérifiabilité restent explicitement hors de la garantie transactionnelle.

Défauts confirmés et corrigés pendant la revue : budget initial d'import vérifié trop tard (trois
pièces de 512 Kio pouvaient être accumulées avant rejet), rangs admin affichés par indice malgré
égalité, tendances v1 départageant encore par identifiant. Tests ajoutés pour le budget partagé ;
les deux derniers affichages utilisent maintenant les rangs/maxima v1 sans changer la méthode.
La relecture a également corrigé la remise à zéro d'un classement en cours d'édition lorsqu'un
autre électeur modifie le compteur : le brouillon local dépend désormais de l'identité du scrutin,
de ses candidats et du seul bulletin de ce membre. Playwright déplace un candidat, fait voter un
autre membre, puis vérifie le classement effectivement enregistré sans incrément lors de la révision.
Le scénario a reproduit un bulletin enregistré A/B au lieu du B/A affiché : les références d'écoute
du bulletin dépendaient de l'objet scrutin complet, donc une variation du compteur réabonnait le
bulletin et remontait l'écran avec l'ancienne sélection. Elles dépendent maintenant des seuls IDs.
Les messages détaillés de refus d'ouverture (média, taille, édition concurrente) sont transmis au toast
administrateur, auparavant générique, afin que l'échec puisse être corrigé puis repris.
La publication utilise aussi le même type Timestamp dans sa première réponse et lors d'une reprise,
au lieu d'un mélange Date ISO/Timestamp JSON ; le test de double publication compare les résultats
sérialisés, sans changer les dates ni résultats historiques stockés.

Le test dépôt/clôture accepte uniquement `ABORTED` ou le diagnostic précis de l'émulateur
`INVALID_ARGUMENT: Transaction is invalid or closed.` après expiration d'un verrou ; il vérifie
l'absence de résultat partiel, puis la reprise et la correspondance exacte avec les bulletins.
Il ne masque pas les autres erreurs de validation. Aucun assouplissement des contrôles applicatifs
n'a été introduit pour ce comportement de l'émulateur.

L'ouverture réserve également la place du résultat (titres du classement inclus) dans le document
Firestore : estimation conservatrice de 900 Kio, avec marge par ligne et pour les métadonnées.
Un titre de 600 000 caractères tient dans la copie seule mais ferait dépasser 1 Mio à la publication :
les tests unitaire et émulateur vérifient son refus avant ouverture, sans changement d'état.
Le plafond de 800 Kio de copie est donc nécessaire mais pas toujours suffisant.
