'use client';

import { MainLayout } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { useAuth, useUser, useFirestore } from '@/firebase';
import { signOut } from 'firebase/auth';
import { useRouter, useSearchParams } from 'next/navigation';
import { ShieldAlert, LogOut, ArrowLeft, Info, Database } from 'lucide-react';
import { Suspense, useState, useEffect } from 'react';
import { doc, getDoc, collection, query, where, limit, getDocs } from 'firebase/firestore';

function DiagnosticPanel({ uid, email }: { uid: string; email: string | null }) {
  const db = useFirestore();
  const [memberDoc, setMemberDoc] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function runDiagnostics() {
      setIsLoading(true);
      try {
        const mSnap = await getDoc(doc(db, 'members', uid));
        setMemberDoc(mSnap.exists() ? mSnap.data() : 'ABSENT');
      } catch (e) {
        console.error("Diagnostic error:", e);
      } finally {
        setIsLoading(false);
      }
    }
    runDiagnostics();
  }, [db, uid]);

  return (
    <div className="mt-12 p-6 bg-black text-white text-left font-mono text-[10px] space-y-4 border-t-4 border-primary">
      <div className="flex items-center gap-2 border-b border-white/20 pb-2">
        <Database className="h-3 w-3" />
        <span className="uppercase font-bold tracking-widest">Diagnostic Système (Debug)</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <section className="space-y-2">
          <p className="text-primary font-bold">--- AUTH & MEMBER ---</p>
          <p><span className="text-gray-400">UID:</span> {uid}</p>
          <p><span className="text-gray-400">Email:</span> {email || 'N/A'}</p>
          <p><span className="text-gray-400">Document Membre:</span> 
            {memberDoc === 'ABSENT' ? <span className="text-destructive">INTROUVABLE</span> : 
             `Role: ${memberDoc?.role}, Status: ${memberDoc?.status}`}
          </p>
        </section>
      </div>

      {isLoading && <div className="animate-pulse text-primary italic">Chargement des diagnostics...</div>}
    </div>
  );
}

function AccessDeniedContent() {
  const auth = useAuth();
  const { user } = useUser();
  const router = useRouter();
  const searchParams = useSearchParams();
  const reason = searchParams.get('reason');
  const isDebugMode = process.env.NODE_ENV !== 'production' || searchParams.get('debug') === '1';

  const handleLogout = async () => {
    await signOut(auth);
    router.push('/login');
  };

  const getDetails = () => {
    switch (reason) {
      case 'no_member':
        return {
          title: "Profil membre introuvable",
          description: "Votre compte n'est pas encore enregistré dans l'annuaire de l'assemblée.",
          technical: "member doc absent"
        };
      case 'inactive':
        return {
          title: "Compte non activé",
          description: "Votre accès est en attente de validation ou a été révoqué.",
          technical: "status != active"
        };
      case 'admin':
        return {
          title: "Accès réservé",
          description: "Cette section est strictement réservée aux administrateurs certifiés.",
          technical: "role != admin"
        };
      default:
        return {
          title: "Accès restreint",
          description: "Vous n'avez pas les autorisations nécessaires pour accéder à cette ressource.",
          technical: reason || "unknown"
        };
    }
  };

  const { title, description, technical } = getDetails();

  return (
    <div className="flex flex-col items-center justify-center py-12 space-y-8 animate-in fade-in duration-700 text-center">
      <div className="relative">
        <ShieldAlert className="h-16 w-16 text-destructive" />
        <div className="absolute -bottom-2 -right-2 bg-white rounded-full p-1 border border-border">
          <Info className="h-4 w-4 text-muted-foreground" />
        </div>
      </div>
      
      <header className="space-y-4">
        <h1 className="text-4xl font-bold tracking-tight">{title}</h1>
        <p className="text-muted-foreground max-w-md mx-auto">{description}</p>
        <div className="pt-2">
          <span className="text-[10px] uppercase tracking-widest bg-secondary px-3 py-1 font-bold text-muted-foreground">
            Code Erreur : {technical}
          </span>
        </div>
      </header>

      <div className="pt-8 space-y-4 w-full max-w-sm">
        <Button 
          variant="outline" 
          onClick={() => router.push('/')}
          className="w-full h-14 rounded-none border-border hover:bg-black hover:text-white transition-all flex items-center justify-center gap-3 font-bold uppercase tracking-widest text-xs"
        >
          <ArrowLeft className="h-4 w-4" />
          Retour à l'accueil
        </Button>
        
        <Button 
          variant="ghost" 
          onClick={handleLogout}
          className="w-full h-14 rounded-none text-muted-foreground hover:text-destructive transition-all flex items-center justify-center gap-3 font-bold uppercase tracking-widest text-xs"
        >
          <LogOut className="h-4 w-4" />
          Changer de compte
        </Button>
      </div>

      {isDebugMode && user && (
        <DiagnosticPanel uid={user.uid} email={user.email} />
      )}
    </div>
  );
}

export default function AccessDeniedPage() {
  return (
    <MainLayout statusText="Accès Refusé">
      <Suspense fallback={
        <div className="flex flex-col items-center justify-center py-24 space-y-4">
          <div className="w-12 h-12 border-t-2 border-primary animate-spin rounded-full"></div>
        </div>
      }>
        <AccessDeniedContent />
      </Suspense>
    </MainLayout>
  );
}
