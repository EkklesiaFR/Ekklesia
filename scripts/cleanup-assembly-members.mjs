--- a/src/app/admin/members/page.tsx
+++ b/src/app/admin/members/page.tsx
@@ -4,11 +4,13 @@
 import { useState, useEffect } from 'react';
 import { collection, query, orderBy, onSnapshot, doc, updateDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
 import { useFirestore } from '@/firebase';
+import { useAuthStatus } from '@/components/auth/AuthStatusProvider';
 import { RequireActiveMember } from '@/components/auth/RequireActiveMember';
 import { MainLayout } from '@/components/layout/MainLayout';
 import { MemberProfile } from '@/types';
 import { toast } from '@/hooks/use-toast';
 import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
 import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
 import { Button } from '@/components/ui/button';
+import { ShieldAlert } from 'lucide-react';
 
 // Helper component for each row to manage its own state
 function MemberRow({ member }: { member: MemberProfile }) {
@@ -79,41 +81,73 @@
 
 
 function MembersContent() {
+  const { isMemberLoading, isAdmin, isActiveMember } = useAuthStatus();
   const db = useFirestore();
   const [members, setMembers] = useState<MemberProfile[]>([]);
   const [isLoading, setIsLoading] = useState(true);
 
   useEffect(() => {
+    if (isMemberLoading) {
+      return;
+    }
+    if (!isAdmin || !isActiveMember) {
+      setIsLoading(false);
+      return;
+    }
+
     console.log('[ADMIN] Subscribing to members list...');
     const q = query(collection(db, 'members'), orderBy('createdAt', 'desc'));
 
     const unsubscribe = onSnapshot(q, (snapshot) => {
       console.log(`[ADMIN] Members snapshot received with ${snapshot.docs.length} documents.`);
       const membersData = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as MemberProfile));
       setMembers(membersData);
       setIsLoading(false);
     }, (error) => {
       console.error('[ADMIN] Members subscription error:', error);
       toast({ variant: "destructive", title: "Erreur de chargement", description: "Impossible de charger la liste des membres." });
       setIsLoading(false);
     });
 
     return () => unsubscribe();
-  }, [db]);
+  }, [db, isMemberLoading, isAdmin, isActiveMember]);
 
-  if (isLoading) {
+  if (isLoading || isMemberLoading) {
     return (
        <div className="flex flex-col items-center justify-center py-32 space-y-6">
           <div className="w-12 h-12 border-t-2 border-primary animate-spin rounded-full"></div>
-          <p className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground">Chargement des membres...</p>
+          <p className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground">Vérification de l'accès...</p>
         </div>
     );
   }
 
+  if (!isAdmin || !isActiveMember) {
+    return (
+      <div className="flex flex-col items-center justify-center py-24 space-y-8 text-center animate-in fade-in duration-700">
+        <ShieldAlert className="h-16 w-16 text-destructive" />
+        <header className="space-y-4">
+          <h1 className="text-4xl font-bold tracking-tight">Accès Réservé</h1>
+          <p className="text-muted-foreground max-w-md mx-auto">
+            Seuls les administrateurs avec un statut actif peuvent accéder à cette page.
+          </p>
+        </header>
+      </div>
+    );
+  }
+
   return (
     <div className="space-y-8 animate-in fade-in duration-700">
        <div className="space-y-2">
           <span className="text-[10px] uppercase tracking-[0.3em] font-bold text-muted-foreground block">Console</span>
           <h1 className="text-4xl font-bold">Gestion des Membres</h1>
         </div>
       <div className="bg-white border">
         <Table>
           <TableHeader>
/**
 * Script de suppression des membres de la sous-collection d'une assemblée.
 * Utilise Firebase Admin SDK.
 *
 * Usage:
 * export GOOGLE_APPLICATION_CREDENTIALS="path/to/serviceAccountKey.json"
 * node scripts/cleanup-assembly-members.mjs <targetAssemblyId> [options]
 *
 * Options:
 * --dry-run        Simule la suppression sans rien effacer.
 * --limit N        Limite la suppression à N documents.
 */

import { initializeApp } from 'firebase-admin/app';
import { getFirestore, FieldPath } from 'firebase-admin/firestore';

const args = process.argv.slice(2);
const targetAssemblyId = args[0];

if (!targetAssemblyId || targetAssemblyId.startsWith('--')) {
  console.error("Usage: node scripts/cleanup-assembly-members.mjs <targetAssemblyId> [--dry-run] [--limit N]");
  process.exit(1);
}

// Parsing des arguments
const isDryRun = args.includes('--dry-run');

// Gestion flexible de --limit (supporte --limit 10 et --limit=10)
let limit = Infinity;
const limitIndex = args.findIndex(arg => arg.startsWith('--limit'));
if (limitIndex !== -1) {
  const arg = args[limitIndex];
  const value = arg.split('=')[1] || args[limitIndex + 1];
  if (value) {
    limit = parseInt(value, 10);
  }
}

// Initialisation Admin SDK
initializeApp();
const db = getFirestore();

async function cleanup() {
  console.log(`\n🔥 Démarrage du nettoyage de la collection 'members' dans : ${targetAssemblyId}`);
  if (isDryRun) console.log("⚠️  MODE SIMULATION (DRY-RUN) - Aucune suppression ne sera effectuée.\n");

  const stats = {
    deleted: 0,
    errors: 0
  };

  const membersCollection = db.collection('assemblies').doc(targetAssemblyId).collection('members');
  let documentsProcessed = 0;
  let lastDoc = null;

  try {
    while (documentsProcessed < limit) {
      const batchSize = Math.min(500, limit - documentsProcessed);
      if (batchSize <= 0) break;

      let query = membersCollection.orderBy(FieldPath.documentId()).limit(batchSize);

      if (lastDoc) {
        query = query.startAfter(lastDoc);
      }

      const snapshot = await query.get();

      if (snapshot.empty) {
        break; // Plus rien à supprimer
      }

      lastDoc = snapshot.docs[snapshot.docs.length - 1];
      console.log(`🔍 Trouvé un lot de ${snapshot.size} documents à traiter...`);

      if (isDryRun) {
        snapshot.docs.forEach(doc => {
          console.log(`[DRY-RUN] Supprimerait le membre ${doc.id}`);
          stats.deleted++;
        });
        documentsProcessed += snapshot.size;
      } else {
        const batch = db.batch();
        snapshot.docs.forEach(doc => batch.delete(doc.ref));
        await batch.commit();

        const deletedCount = snapshot.size;
        stats.deleted += deletedCount;
        documentsProcessed += deletedCount;
        console.log(`[OK] Lot de ${deletedCount} membres supprimés.`);
      }
    }

    if (documentsProcessed === 0) {
      console.log('✅ La sous-collection est déjà vide ou la limite était de 0.');
    }

    console.log("\n" + "=".repeat(40));
    console.log("📊 RÉSUMÉ FINAL");
    const label = isDryRun ? 'Membres à supprimer' : 'Membres supprimés  ';
    console.log(`${label} : ${stats.deleted}`);
    console.log(`Erreurs      : ${stats.errors}`);
    if (documentsProcessed >= limit && limit < Infinity) {
      console.log(`Limite de ${limit} atteinte.`);
    }
    console.log("=".repeat(40) + "\n");

  } catch (err) {
    console.error("❌ Erreur fatale lors du nettoyage :", err);
    process.exit(1);
  }
}

cleanup();
