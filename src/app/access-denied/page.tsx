'use client';

import { MainLayout } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { useAuth, useUser, useFirestore } from '@/firebase';
import { signOut } from 'firebase/auth';
import { useRouter, useSearchParams } from 'next/navigation';
import { ShieldAlert, LogOut, ArrowLeft, Info, Database, RefreshCw, CheckCircle2, XCircle, AlertTriangle, Layers } from 'lucide-react';
import { Suspense, useState, useEffect, useCallback } from 'react';
import { doc, getDoc, collection, getDocs, limit } from 'firebase/firestore';
import { cn } from '@/lib/utils';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { DEFAULT_ASSEMBLY_ID } from '@/components/auth/AuthStatusProvider';

function DiagnosticPanel({ user }: { user: any }) {
  const db = useFirestore();
  const [memberDoc, setMemberDoc] = useState<any>(null);
  const [legacyDoc, setLegacyDoc] = useState<any>(null);
  const [assemblies, setAssemblies] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  const runDiagnostics = useCallback(async () => {
    if (!user?.uid) return;
    setIsLoading(true);
    setError(null);
    try {
      // 1. Check Hierarchical Doc
      const docRef = doc(db, 'assemblies', DEFAULT_ASSEMBLY_ID, 'members', user.uid);
      const mSnap = await getDoc(docRef);
      setMemberDoc(mSnap.exists() ? mSnap.data() : 'ABSENT');

      // 2. Check Legacy Root Doc
      const legacyRef = doc(db, 'members', user.uid);
      try {
        const lSnap = await getDoc(legacyRef);
        setLegacyDoc(lSnap.exists() ? lSnap.data() : 'ABSENT');
      } catch (e) {
        setLegacyDoc('DENIED_OR_MISSING');
      }

      // 3. List existing assemblies to find where the data is
      const asmCol = collection(db, 'assemblies');
      const asmSnap = await getDocs(query(asmCol, limit(5)));
      setAssemblies(asmSnap.docs.map(d => d.id));

    } catch (e: any) {
      console.error("Diagnostic error:", e);
      setError(e.message || "Erreur de diagnostic");
    } finally {
      setIsLoading(false);
    }
  }, [db, user?.uid]);

  useEffect(() => {
    runDiagnostics();
  }, [runDiagnostics, refreshKey]);

  return (
    <div className="mt-16 w-full max-w-3xl mx-auto border border-border bg-secondary/5 overflow-hidden font-mono text-[11px]">
      <div className="bg-black p-4 flex items-center justify-between">
        <div className="flex items-center gap-3 text-white">
          <Database className="h-4 w-4 text-primary" />
          <span className="text-[10px] uppercase font-black tracking-widest">Console de Diagnostic Système</span>
        </div>
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={() => setRefreshKey(k => k + 1)}
          className="h-8 text-[10px] text-gray-400 hover:text-white gap-2"
        >
          <RefreshCw className={cn("h-3 w-3", isLoading && "animate-spin")} /> Réinitialiser
        </Button>
      </div>

      <div className="p-8 space-y-8 text-left">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
          {/* Environment */}
          <section className="space-y-4">
            <h4 className="text-[9px] uppercase font-bold text-muted-foreground border-b border-border pb-2 flex items-center gap-2">
               <Layers className="h-3 w-3" /> Environnement
            </h4>
            <div className="space-y-2">
              <p><span className="text-muted-foreground">ASSEMBLY_ID (Target):</span> <code className="bg-primary/10 text-primary px-1">{DEFAULT_ASSEMBLY_ID}</code></p>
              <p><span className="text-muted-foreground">Assemblies trouvées:</span> {assemblies.join(', ') || 'Aucune'}</p>
              <p><span className="text-muted-foreground">User UID:</span> <code className="block mt-1 truncate">{user.uid}</code></p>
            </div>
          </section>

          {/* New Path */}
          <section className="space-y-4">
            <h4 className="text-[9px] uppercase font-bold text-muted-foreground border-b border-border pb-2">Profil Actuel (Nouvelle Route)</h4>
            <div className="space-y-2">
              <p>Statut: <span className={cn("font-bold", memberDoc?.status === 'active' ? 'text-green-600' : 'text-orange-500')}>{memberDoc?.status || 'ABSENT'}</span></p>
              <p>Rôle: <span className="font-bold">{memberDoc?.role || 'N/A'}</span></p>
              <p className="text-[9px] text-muted-foreground italic">Chemin: assemblies/{DEFAULT_ASSEMBLY_ID}/members/{user.uid}</p>
            </div>
          </section>
        </div>

        {/* Legacy Check */}
        <div className="p-4 bg-orange-500/5 border border-orange-500/20 rounded">
          <h4 className="text-[9px] uppercase font-bold text-orange-600 mb-2">Vérification de l'Ancienne Version (Legacy Root)</h4>
          {legacyDoc === 'ABSENT' ? (
            <p className="text-muted-foreground italic">Aucun ancien profil trouvé à la racine.</p>
          ) : legacyDoc === 'DENIED_OR_MISSING' ? (
            <p className="text-destructive">Accès refusé ou document racine manquant.</p>
          ) : (
            <div className="grid grid-cols-2 gap-4">
               <p>Ancien Statut: <span className="text-green-600 font-bold">{legacyDoc?.status}</span></p>
               <p>Ancien Rôle: <span className="font-bold">{legacyDoc?.role}</span></p>
               <p className="col-span-2 text-[9px] text-primary">✓ Un profil actif a été détecté. Le système va tenter une migration automatique lors de votre prochaine tentative.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ... rest of the file (AccessDeniedContent, AccessDeniedPage) remains largely the same but with diagnostics
import { query } from 'firebase/firestore';

function AccessDeniedContent() {
  const auth = useAuth();
  const { user } = useUser();
  const router = useRouter();
  const searchParams = useSearchParams();
  const reason = searchParams.get('reason');

  const handleLogout = async () => {
    await signOut(auth);
    router.push('/login');
  };

  const { title, description } = {
    title: "Accès en attente",
    description: "Votre demande d'adhésion est en cours de validation par le conseil."
  };

  return (
    <div className="flex flex-col items-center justify-center py-12 space-y-8 animate-in fade-in duration-700 text-center">
      <div className="relative">
        <ShieldAlert className="h-16 w-16 text-destructive" />
      </div>
      
      <header className="space-y-4">
        <h1 className="text-4xl font-bold tracking-tight">{title}</h1>
        <p className="text-muted-foreground max-w-md mx-auto">{description}</p>
      </header>

      <div className="pt-8 space-y-4 w-full max-w-sm flex flex-col items-center">
        <Button 
          variant="outline" 
          onClick={() => window.location.href = '/'}
          className="w-full h-14 rounded-none font-bold uppercase tracking-widest text-xs"
        >
          Tenter de se reconnecter (Migration)
        </Button>
        
        <Button 
          variant="ghost" 
          onClick={handleLogout}
          className="w-full h-14 rounded-none text-muted-foreground font-bold uppercase tracking-widest text-xs"
        >
          <LogOut className="h-4 w-4" /> Changer de compte
        </Button>
      </div>

      {user && <DiagnosticPanel user={user} />}
    </div>
  );
}

export default function AccessDeniedPage() {
  return (
    <MainLayout statusText="Sécurité">
      <Suspense fallback={null}>
        <AccessDeniedContent />
      </Suspense>
    </MainLayout>
  );
}