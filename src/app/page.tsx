'use client';

import { MainLayout } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { ArrowRight, LogIn, LayoutDashboard } from 'lucide-react';
import { useAuthStatus } from '@/components/auth/AuthStatusProvider';
import { useUser } from '@/firebase';

export default function Home() {
  const { user } = useUser();
  const { isActiveMember } = useAuthStatus();

  return (
    <MainLayout statusText="Présentation">
      <div className="space-y-24 animate-in fade-in slide-in-from-bottom-4 duration-1000 pb-20">
        <section className="space-y-12">
          <div className="space-y-4">
            <span className="text-xs uppercase tracking-[0.3em] font-bold text-muted-foreground block">
              Assemblée Ekklesia
            </span>
            <h1 className="text-5xl md:text-7xl font-bold leading-[1.1] tracking-tight text-black">
              Votre voix,<br />votre communauté.
            </h1>
          </div>
          <p className="text-xl md:text-2xl text-muted-foreground leading-relaxed max-w-2xl font-medium">
            Plateforme de participation citoyenne et de vote institutionnel pour l'Assemblée.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 pt-4">
            {user && isActiveMember ? (
              <Link href="/assembly">
                <Button size="lg" className="w-full sm:w-auto bg-black hover:bg-black/90 text-white rounded-none px-10 py-8 text-lg flex items-center gap-3">
                  <LayoutDashboard className="h-5 w-5" />
                  Accéder à l'assemblée
                </Button>
              </Link>
            ) : (
              <>
                <Link href="/login">
                  <Button size="lg" className="w-full sm:w-auto bg-black hover:bg-black/90 text-white rounded-none px-10 py-8 text-lg flex items-center gap-3">
                    <LogIn className="h-5 w-5" />
                    Se connecter
                  </Button>
                </Link>
                <Link href="/assembly">
                  <Button size="lg" variant="outline" className="w-full sm:w-auto border-black hover:bg-black hover:text-white rounded-none px-10 py-8 text-lg flex items-center gap-3">
                    Accès Membre
                    <ArrowRight className="h-5 w-5" />
                  </Button>
                </Link>
              </>
            )}
          </div>
        </section>

        <section className="grid grid-cols-1 md:grid-cols-3 gap-12 border-t border-border pt-16">
          <div className="space-y-4">
            <h3 className="text-lg font-bold uppercase tracking-widest">Transparence</h3>
            <p className="text-muted-foreground text-sm leading-relaxed">
              Consultez les projets et les budgets en toute clarté avant chaque session de vote.
            </p>
          </div>
          <div className="space-y-4">
            <h3 className="text-lg font-bold uppercase tracking-widest">Démocratie</h3>
            <p className="text-muted-foreground text-sm leading-relaxed">
              Un système de vote préférentiel pour garantir que chaque voix compte réellement.
            </p>
          </div>
          <div className="space-y-4">
            <h3 className="text-lg font-bold uppercase tracking-widest">Engagement</h3>
            <p className="text-muted-foreground text-sm leading-relaxed">
              Participez activement aux décisions qui façonnent l'avenir de notre communauté.
            </p>
          </div>
        </section>
      </div>
    </MainLayout>
  );
}
