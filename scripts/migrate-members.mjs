/**
 * @fileOverview Script de migration sécurisé pour transférer les membres de la racine vers une assemblée cible.
 * Utilise le SDK Firebase Admin.
 * 
 * Usage:
 * node scripts/migrate-members.mjs <targetAssemblyId> [--dry-run] [--limit N] [--only-admins]
 */

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';

// Configuration
const args = process.argv.slice(2);
const targetAssemblyId = args.find(arg => !arg.startsWith('--'));
const isDryRun = args.includes('--dry-run');
const onlyAdmins = args.includes('--only-admins');
const limitArg = args.find(arg => arg.startsWith('--limit='));
const limit = limitArg ? parseInt(limitArg.split('=')[1], 10) : null;

if (!targetAssemblyId) {
  console.error('❌ Erreur: targetAssemblyId manquant.');
  console.log('Usage: node scripts/migrate-members.mjs <targetAssemblyId> [--dry-run] [--limit=N] [--only-admins]');
  process.exit(1);
}

// Initialisation Firebase Admin
// Note: Utilise les identifiants par défaut ou la variable d'environnement GOOGLE_APPLICATION_CREDENTIALS
initializeApp();
const db = getFirestore();

async function migrate() {
  console.log(`🚀 Démarrage de la migration vers l'assemblée: ${targetAssemblyId}`);
  if (isDryRun) console.log('⚠️ MODE DRY-RUN ACTIVÉ (Aucune écriture)');
  if (onlyAdmins) console.log('🛡️ FILTRE: Uniquement les administrateurs');
  if (limit) console.log(`🔢 LIMITE: ${limit} membres`);

  const stats = {
    totalLegacy: 0,
    toMigrate: 0,
    migrated: 0,
    skipped: 0,
    errors: 0
  };

  try {
    const legacyRef = db.collection('members');
    const snapshot = await legacyRef.get();
    stats.totalLegacy = snapshot.size;

    console.log(`📋 ${stats.totalLegacy} membres trouvés à la racine.`);

    let processedCount = 0;

    for (const doc of snapshot.docs) {
      if (limit && processedCount >= limit) break;

      const data = doc.data();
      const uid = doc.id;

      // Filtre Admin
      if (onlyAdmins && data.role !== 'admin') continue;

      processedCount++;
      stats.toMigrate++;

      // 1. Normalisation du Rôle
      let role = 'member';
      if (data.role === 'admin') role = 'admin';

      // 2. Normalisation du Statut
      let status = 'pending';
      const validStatuses = ['active', 'pending', 'suspended'];
      if (validStatuses.includes(data.status)) {
        status = data.status;
      }

      // 3. Gestion des Timestamps (createdAt / updatedAt)
      let createdAt = Timestamp.now();
      const rawCreated = data.createdAt || data.joinedAt;
      if (rawCreated) {
        if (rawCreated instanceof Timestamp) {
          createdAt = rawCreated;
        } else if (typeof rawCreated === 'string') {
          createdAt = Timestamp.fromDate(new Date(rawCreated));
        } else if (rawCreated._seconds) {
          createdAt = new Timestamp(rawCreated._seconds, rawCreated._nanoseconds || 0);
        }
      }

      // 4. Préparation du document cible
      const targetDocRef = db.collection('assemblies').doc(targetAssemblyId).collection('members').doc(uid);
      
      // Vérification existence
      const targetSnap = await targetDocRef.get();
      if (targetSnap.exists()) {
        console.log(`[SKIP] Member ${uid} already exists in target.`);
        stats.skipped++;
        continue;
      }

      const newData = {
        id: uid,
        email: data.email || '',
        displayName: data.displayName || '',
        role: role,
        status: status,
        createdAt: createdAt,
        updatedAt: Timestamp.now()
      };

      if (isDryRun) {
        console.log(`[DRY-RUN] Would migrate ${uid} (${role}, ${status})`);
        stats.migrated++;
      } else {
        try {
          await targetDocRef.set(newData);
          console.log(`[OK] Migrated ${uid}`);
          stats.migrated++;
        } catch (err) {
          console.error(`[ERROR] Failed to migrate ${uid}:`, err.message);
          stats.errors++;
        }
      }
    }

    console.log('\n--- RÉSUMÉ FINAL ---');
    console.log(`Total Racine      : ${stats.totalLegacy}`);
    console.log(`Cibles Identifiées: ${stats.toMigrate}`);
    console.log(`Migrés            : ${stats.migrated}`);
    console.log(`Ignorés (existants): ${stats.skipped}`);
    console.log(`Erreurs           : ${stats.errors}`);
    console.log('--------------------\n');

  } catch (error) {
    console.error('❌ Erreur critique pendant la migration:', error);
  }
}

migrate();
