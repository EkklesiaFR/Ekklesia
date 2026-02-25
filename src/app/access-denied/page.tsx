'use client';

import { MainLayout } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { useAuth, useUser, useFirestore } from '@/firebase';
import { signOut } from 'firebase/auth';
import { useRouter, useSearchParams } from 'next/navigation';
import { ShieldAlert, LogOut, ArrowLeft, Info, Database, RefreshCw, CheckCircle2, XCircle, AlertTriangle } from 'lucide-react';
import { Suspense, useState, useEffect, useCallback } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { cn } from '@/lib/utils';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

function DiagnosticPanel({ user }: { user: any }) {
  const db = useFirestore();
  const [memberDoc, setMemberDoc] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  const runDiagnostics = useCallback(async () => {
    if (!user?.uid) return;
    setIsLoading(true);
    setError(null);
    try {
      const docRef = doc(db, 'members', user.uid);
      const mSnap = await getDoc(docRef);
      if (mSnap.exists()) {
        setMemberDoc(mSnap.data());
      } else {
        setMemberDoc('ABSENT');
      }
    } catch (e: any) {
      console.error("Diagnostic error:", e);
      setError(e.message || "Erreur inconnue lors de la lecture Firestore");
      setMemberDoc('ERROR');
    } finally {
      setIsLoading(false);
    }
  }, [db, user?.uid]);

  useEffect(() => {
    runDiagnostics();
  }, [runDiagnostics, refreshKey]);

  return (
    <div className="mt-16 w-full max-w-2xl mx-auto border border-border bg-secondary/5 overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-1000">
      <div className="bg-black p-4 flex items-center justify-between">
        <div className="flex items-center gap-3 text-white">
          <Database className="h-4 w-4 text-primary" />
          <span className="text-[10px] uppercase font-black tracking-widest text-white">Diagnostic Système</span>
        </div>
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={() => setRefreshKey(k => k + 1)}
          disabled={isLoading}
          className="h-8 text-[10px] uppercase font-bold text-gray-400 hover:text-white hover:bg-white/10 gap-2"
        >
          <RefreshCw className={cn("h-3 w-3", isLoading && "animate-spin")} />
          Recharger
        </Button>
      </div>

      <div className="p-8 space-y-8">
        {error && (
          <Alert variant="destructive" className="rounded-none border-destructive/50 bg-destructive/5">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle className="text-[10px] uppercase font-black tracking-widest">Erreur Firestore</AlertTitle>
            <AlertDescription className="text-xs font-mono mt-2">
              {error}
            </AlertDescription>
          </Alert>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-10 text-left font-mono text-[11px]">
          {/* Firebase Auth Data */}
          <section className="space-y-4">
            <h4 className="text-[9px] uppercase font-bold text-muted-foreground border-b border-border pb-2 tracking-widest">Auth (Firebase)</h4>
            <div className="space-y-3">
              <p><span className="text-muted-foreground">UID:</span> <code className="bg-secondary px-1 rounded block mt-1 truncate">{user.uid}</code></p>
              <p><span className="text-muted-foreground">Email:</span> {user.email}</p>
              <p className="flex items-center gap-2">
                <span className="text-muted-foreground">Vérifié:</span> 
                {user.emailVerified ? (
                  <span className="text-green-600 flex items-center gap-1 font-bold"><CheckCircle2 className="h-3 w-3" /> OUI</span>
                ) : (
                  <span className="text-destructive flex items-center gap-1 font-bold"><XCircle className="h-3 w-3" /> NON</span>
                )}
              </p>
            </div>
          </section>

          {/* Firestore Data */}
          <section className="space-y-4">
            <h4 className="text-[9px] uppercase font-bold text-muted-foreground border-b border-border pb-2 tracking-widest">Profil (Firestore)</h4>
            <div className="space-y-3">
              <p className="flex items-center gap-2">
                <span className="text-muted-foreground">Document:</span> 
                {memberDoc === 'ABSENT' ? (
                  <span className="text-destructive font-bold">INTROUVABLE</span>
                ) : memberDoc === 'ERROR' ? (
                  <span className="text-destructive font-bold">ERREUR LECTURE</span>
                ) : (
                  <span className="text-green-600 font-bold">EXISTE (members/{user.uid})</span>
                )}
              </p>
              <p>
                <span className="text-muted-foreground">Statut:</span> 
                <span className={cn(
                  "ml-2 font-bold uppercase",
                  memberDoc?.status === 'active' ? "text-green-600" : "text-orange-500"
                )}>
                  {memberDoc === 'ABSENT' || memberDoc === 'ERROR' ? 'N/A' : (memberDoc?.status || 'NON DÉFINI')}
                </span>
              </p>
              <p>
                <span className="text-muted-foreground">Rôle:</span> 
                <span className="ml-2 font-bold uppercase text-black">
                  {memberDoc === 'ABSENT' || memberDoc === 'ERROR' ? 'N/A' : (memberDoc?.role || 'NON DÉFINI')}
                </span>
              </p>
            </div>
          </section>
        </div>
        
        <div className="p-4 bg-primary/5 border border-primary/20 flex gap-4 items-start">
          <Info className="h-4 w-4 text-primary mt-0.5 shrink-0" />
          <p className="text-[10px] text-muted-foreground leading-relaxed italic">
            Votre statut doit être <strong>ACTIVE</strong> pour accéder à l&apos;Assemblée. 
            Si vous venez d&apos;être validé par un administrateur, cliquez sur le bouton <strong>Recharger</strong> ci-dessus.
          </p>
        </div>
      </div>
    </div>
  );
}

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

  const getDetails = () => {
    switch (reason) {
      case 'no_member':
        return {
          title: "Profil introuvable",
          description: "Votre compte n'est pas encore enregistré dans l'annuaire de l'assemblée.",
          technical: "MEMBER_DOC_ABSENT"
        };
      case 'inactive':
      case 'pending':
        return {
          title: "Accès en attente",
          description: "Votre demande d'adhésion est en cours de validation par le conseil.",
          technical: "STATUS_NOT_ACTIVE"
        };
      case 'admin':
        return {
          title: "Zone réservée",
          description: "Cette section nécessite des privilèges d'administration certifiés.",
          technical: "ROLE_NOT_ADMIN"
        };
      default:
        return {
          title: "Accès restreint",
          description: "Vous n'avez pas les autorisations nécessaires pour accéder à cette ressource.",
          technical: reason?.toUpperCase() || "RESTRICTION_INCONNUE"
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
            CODE TECHNIQUE : {technical}
          </span>
        </div>
      </header>

      <div className="pt-8 space-y-4 w-full max-w-sm flex flex-col items-center">
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
          Se déconnecter / Changer de compte
        </Button>
      </div>

      {user && (
        <DiagnosticPanel user={user} />
      )}
    </div>
  );
}

export default function AccessDeniedPage() {
  return (
    <MainLayout statusText="Vérification">
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
