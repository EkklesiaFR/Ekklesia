/**
 * SCRIPT DE MIGRATION SÉCURISÉ (ADMIN-ONLY)
 * 
 * Usage: 
 * 1. Téléchargez votre clé de service Firebase (JSON)
 * 2. Exportez le chemin: export GOOGLE_APPLICATION_CREDENTIALS="path/to/key.json"
 * 3. Exécutez: node scripts/migrate-members.mjs <target-assembly-id>
 */

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { readFile } from 'fs/promises';

const targetAssemblyId = process.argv[2] || 'default-assembly';

async function migrate() {
  console.log(`🚀 Démarrage de la migration vers l'assemblée : ${targetAssemblyId}`);
  
  // L'initialisation utilise les identifiants par défaut du système
  initializeApp();
  const db = getFirestore();

  const legacyCol = db.collection('members');
  const legacySnap = await legacyCol.get();

  if (legacySnap.empty) {
    console.log("ℹ️ Aucune donnée trouvée dans la collection racine 'members'.");
    return;
  }

  console.log(`📦 ${legacySnap.size} profils trouvés à la racine.`);

  const batch = db.batch();
  let count = 0;

  for (const doc of legacySnap.docs) {
    const data = doc.data();
    const targetRef = db.collection('assemblies').doc(targetAssemblyId).collection('members').doc(doc.id);
    
    // Vérifier si un profil existe déjà pour ne pas écraser des données plus récentes
    const existingSnap = await targetRef.get();
    
    if (!existingSnap.exists || existingSnap.data().status === 'pending') {
      console.log(`   - Migration de ${data.email || doc.id} (${data.role}/${data.status})`);
      
      batch.set(targetRef, {
        id: doc.id,
        email: data.email || '',
        displayName: data.displayName || '',
        role: data.role || 'member',
        status: data.status || 'pending',
        createdAt: data.createdAt || FieldValue.serverTimestamp(),
        migratedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp()
      }, { merge: true });
      
      count++;
    } else {
      console.log(`   - Saut de ${data.email || doc.id} (Profil déjà actif dans la cible)`);
    }

    // Limite de batch Firestore (500)
    if (count > 0 && count % 400 === 0) {
      await batch.commit();
      console.log(`✅ Batch intermédiaire validé...`);
    }
  }

  if (count > 0) {
    await batch.commit();
    console.log(`🎉 Migration terminée avec succès : ${count} profils transférés.`);
  } else {
    console.log("∅ Aucun profil ne nécessitait de migration.");
  }
}

migrate().catch(err => {
  console.error("❌ Erreur critique lors de la migration :", err);
  process.exit(1);
});
