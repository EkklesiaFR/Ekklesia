
'use client';

import { RequireActiveMember } from '@/components/auth/RequireActiveMember';
import { MainLayout } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { ArrowRight, LayoutGrid } from 'lucide-react';

export default function Home() {
  return (
    <RequireActiveMember>
      <MainLayout statusText="Vote ouvert">
        <div className="space-y-24 animate-in fade-in slide-in-from-bottom-4 duration-1000 pb-20">
          <section className="space-y-12">
            <div className="space-y-4">
              <span className="text-xs uppercase tracking-[0.3em] font-bold text-muted-foreground block">
                assemblée de mars 2024
              </span>
              <h1 className="text-5xl md:text-7xl font-bold leading-[1.1] tracking-tight text-black">
                Votre voix,<br />votre communauté.
              </h1>
            </div>
            <p className="text-xl md:text-2xl text-muted-foreground leading-relaxed max-w-2xl font-medium">
              Bienvenue sur la plateforme de vote de l'Assemblée Ekklesia.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 pt-4">
              <Link href="/projects">
                <Button size="lg" className="w-full sm:w-auto bg-black hover:bg-black/90 text-white rounded-none px-10 py-8 text-lg flex items-center gap-3">
                  <LayoutGrid className="h-5 w-5" />
                  Voir les projets
                </Button>
              </Link>
              <Link href="/vote">
                <Button size="lg" variant="outline" className="w-full sm:w-auto border-black hover:bg-black hover:text-white rounded-none px-10 py-8 text-lg flex items-center gap-3">
                  Votez
                  <ArrowRight className="h-5 w-5" />
                </Button>
              </Link>
            </div>
          </section>
        </div>
      </MainLayout>
    </RequireActiveMember>
  );
}
