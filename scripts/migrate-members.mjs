/**
 * Script de migration des membres de la racine (/members) vers une assemblée cible.
 * Utilise Firebase Admin SDK.
 * 
 * Usage:
 * export GOOGLE_APPLICATION_CREDENTIALS="path/to/serviceAccountKey.json"
 * node scripts/migrate-members.mjs <targetAssemblyId> [options]
 * 
 * Options:
 * --dry-run        Simule la migration sans écrire dans Firestore.
 * --limit N        Limite la migration à N membres.
 * --only-admins    Migre uniquement les utilisateurs ayant un rôle admin à la racine.
 */

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';

const args = process.argv.slice(2);
const targetAssemblyId = args[0];

if (!targetAssemblyId || targetAssemblyId.startsWith('--')) {
  console.error("Usage: node scripts/migrate-members.mjs <targetAssemblyId> [--dry-run] [--limit N] [--only-admins]");
  process.exit(1);
}

// Parsing des arguments
const isDryRun = args.includes('--dry-run');
const onlyAdmins = args.includes('--only-admins');

// Gestion flexible de --limit (supporte --limit 10 et --limit=10)
let limit = Infinity;
const limitIndex = args.findIndex(arg => arg.startsWith('--limit'));
if (limitIndex !== -1) {
  const arg = args[limitIndex];
  if (arg.includes('=')) {
    limit = parseInt(arg.split('=')[1], 10);
  } else if (args[limitIndex + 1]) {
    limit = parseInt(args[limitIndex + 1], 10);
  }
}

// Initialisation Admin SDK
// Si GOOGLE_APPLICATION_CREDENTIALS n'est pas défini, initializeApp() tentera d'utiliser les credentials par défaut de l'environnement
initializeApp();
const db = getFirestore();

async function migrate() {
  console.log(`\n🚀 Démarrage de la migration vers l'assemblée : ${targetAssemblyId}`);
  if (isDryRun) console.log("⚠️  MODE SIMULATION (DRY-RUN) ACTIVE - Aucune écriture ne sera effectuée.\n");

  const stats = {
    totalLegacy: 0,
    toMigrate: 0,
    migrated: 0,
    skipped: 0,
    errors: 0
  };

  try {
    const legacyCollection = db.collection('members');
    const legacySnapshot = await legacyCollection.get();
    stats.totalLegacy = legacySnapshot.size;

    console.log(`🔍 ${stats.totalLegacy} membres trouvés à la racine.`);

    for (const legacyDoc of legacySnapshot.docs) {
      if (stats.migrated + stats.skipped + stats.errors >= limit) {
        console.log(`\n🛑 Limite de ${limit} atteint. Fin de la migration.`);
        break;
      }

      const uid = legacyDoc.id;
      const data = legacyDoc.data();

      // Filtrage --only-admins
      const roleRaw = data.role || 'member';
      if (onlyAdmins && roleRaw !== 'admin') {
        continue;
      }

      stats.toMigrate++;

      // Normalisation Role
      const normalizedRole = (roleRaw === 'admin' || roleRaw === 'member') ? roleRaw : 'member';
      
      // Normalisation Status
      const statusRaw = data.status || 'pending';
      const normalizedStatus = ['active', 'pending', 'suspended'].includes(statusRaw) ? statusRaw : 'pending';

      // Gestion des dates (Whitelist strict)
      let createdAt = Timestamp.now();
      if (data.createdAt instanceof Timestamp) {
        createdAt = data.createdAt;
      } else if (data.joinedAt instanceof Timestamp) {
        createdAt = data.joinedAt;
      } else if (data.createdAt) {
        try {
          createdAt = Timestamp.fromDate(new Date(data.createdAt));
        } catch (e) {
          createdAt = Timestamp.now();
        }
      }

      const targetRef = db.collection('assemblies').doc(targetAssemblyId).collection('members').doc(uid);
      const targetSnap = await targetRef.get();

      if (targetSnap.exists) {
        console.log(`[SKIP] Member ${uid} already exists in ${targetAssemblyId}.`);
        stats.skipped++;
        continue;
      }

      const newMemberData = {
        id: uid,
        email: data.email || '',
        displayName: data.displayName || data.email?.split('@')[0] || 'Membre',
        role: normalizedRole,
        status: normalizedStatus,
        createdAt: createdAt,
        updatedAt: Timestamp.now()
      };

      if (isDryRun) {
        console.log(`[DRY-RUN] Would migrate ${uid} as ${normalizedRole} (${normalizedStatus})`);
        stats.migrated++;
      } else {
        try {
          await targetRef.set(newMemberData);
          console.log(`[OK] Member ${uid} migrated.`);
          stats.migrated++;
        } catch (err) {
          console.error(`[ERROR] Failed to migrate ${uid}:`, err.message);
          stats.errors++;
        }
      }
    }

    console.log("\n" + "=".repeat(40));
    console.log("📊 RÉSUMÉ FINAL");
    console.log(`Total racine : ${stats.totalLegacy}`);
    console.log(`Ciblés       : ${stats.toMigrate}`);
    console.log(`Migrés       : ${stats.migrated}`);
    console.log(`Ignorés      : ${stats.skipped}`);
    console.log(`Erreurs      : ${stats.errors}`);
    console.log("=".repeat(40) + "\n");

  } catch (err) {
    console.error("❌ Erreur fatale lors de la migration :", err);
    process.exit(1);
  }
}

migrate();
