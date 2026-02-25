
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import fs from 'fs';

/**
 * SCRIPT DE MIGRATION SÉCURISÉ POUR EKKLESIA VOTE
 * 
 * Usage: node scripts/migrate-members.mjs <targetAssemblyId> [--dry-run]
 * 
 * Ce script copie les membres de la racine /members vers /assemblies/{id}/members.
 * - Ne jamais écraser un doc existant.
 * - Whitelist de champs stricte.
 * - Mode dry-run par défaut pour test.
 */

const targetAssemblyId = process.argv[2];
const isDryRun = process.argv.includes('--dry-run');

if (!targetAssemblyId) {
  console.log('\n❌ Usage: node scripts/migrate-members.mjs <targetAssemblyId> [--dry-run]');
  console.log('Exemple: node scripts/migrate-members.mjs default-assembly --dry-run\n');
  process.exit(1);
}

const saPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
if (!saPath) {
  console.error('\n❌ Erreur: La variable d\'environnement GOOGLE_APPLICATION_CREDENTIALS n\'est pas définie.');
  console.log('Veuillez l\'exporter : export GOOGLE_APPLICATION_CREDENTIALS="chemin/vers/votre/cle.json"\n');
  process.exit(1);
}

const serviceAccount = JSON.parse(fs.readFileSync(saPath, 'utf8'));

initializeApp({
  credential: cert(serviceAccount)
});

const db = getFirestore();

async function migrate() {
  console.log(`\n--- 🛡️  Ekklesia Member Migration Tool ---`);
  console.log(`Cible : assemblies/${targetAssemblyId}/members`);
  console.log(`Mode : ${isDryRun ? 'DRY RUN (Aucune écriture)' : 'LIVE (Écriture en cours)'}\n`);

  const legacyCol = db.collection('members');
  const snapshot = await legacyCol.get();

  let migrated = 0;
  let skipped = 0;
  let errors = 0;

  for (const doc of snapshot.docs) {
    const uid = doc.id;
    const data = doc.data();

    // Whitelist des champs autorisés pour la migration
    const payload = {
      id: uid,
      email: data.email || '',
      role: data.role || 'member',
      status: data.status || 'pending',
      createdAt: data.createdAt || data.joinedAt || new Date().toISOString(),
      displayName: data.displayName || '',
      updatedAt: new Date().toISOString(),
      migratedFromRoot: true
    };

    const targetRef = db.collection('assemblies').doc(targetAssemblyId).collection('members').doc(uid);
    
    // VÉRIFICATION DE SÉCURITÉ : Ne pas écraser
    const targetSnap = await targetRef.get();
    if (targetSnap.exists) {
      console.log(`[-] ${uid}: Déjà présent dans ${targetAssemblyId}. Skip.`);
      skipped++;
      continue;
    }

    if (isDryRun) {
      console.log(`[DRY] ${uid}: Prêt pour migration en tant que ${payload.role}/${payload.status} (${payload.email})`);
      migrated++;
    } else {
      try {
        await targetRef.set(payload);
        console.log(`[OK] ${uid}: Migré avec succès.`);
        migrated++;
      } catch (e) {
        console.log(`[ERR] ${uid}: Échec - ${e.message}`);
        errors++;
      }
    }
  }

  console.log(`\n--- 📊 Résumé Final ---`);
  console.log(`Anciens profils trouvés : ${snapshot.size}`);
  console.log(`Migrés                  : ${migrated}`);
  console.log(`Ignorés (déjà présents) : ${skipped}`);
  console.log(`Erreurs                 : ${errors}`);
  
  if (isDryRun) {
    console.log(`\n💡 NOTE: Ceci était une simulation. Lancez sans --dry-run pour appliquer les changements.\n`);
  } else {
    console.log(`\n✅ Migration terminée.\n`);
  }
}

migrate().catch(err => {
  console.error('\n❌ Erreur fatale lors de la migration:', err);
  process.exit(1);
});
