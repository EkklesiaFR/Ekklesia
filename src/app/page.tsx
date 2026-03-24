'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { LogIn, LayoutDashboard, Users, MoveRight, Landmark } from 'lucide-react';

import { MainLayout } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { GlassCard } from '@/components/ui/glass-card';

import { useAuthStatus } from '@/components/auth/AuthStatusProvider';
import { useUser } from '@/firebase';

type HomeProject = {
  id: string;
  title: string;
  summary: string;
  budget: string;
  imageUrl: string;
};

type HomePublicData = {
  membersCount: number;
  featuredProjects: HomeProject[];
  error?: string;
};

export default function Home() {
  const { user } = useUser();
  const { isActiveMember } = useAuthStatus();

  const [homeData, setHomeData] = useState<HomePublicData>({
    membersCount: 0,
    featuredProjects: [],
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const loadHomeData = async () => {
      try {
        setIsLoading(true);

        const res = await fetch('/api/public/home', {
          method: 'GET',
          cache: 'no-store',
        });

        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }

        const payload = (await res.json()) as HomePublicData;

        if (!isMounted) return;

        setHomeData({
          membersCount: typeof payload.membersCount === 'number' ? payload.membersCount : 0,
          featuredProjects: Array.isArray(payload.featuredProjects)
            ? payload.featuredProjects
            : [],
        });
      } catch (error) {
        console.error('[HOME] Failed to load public home data:', error);

        if (!isMounted) return;

        setHomeData({
          membersCount: 0,
          featuredProjects: [],
        });
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    loadHomeData();

    return () => {
      isMounted = false;
    };
  }, []);

  const membersCount = homeData.membersCount ?? 0;
  const projects = homeData.featuredProjects ?? [];

  const communityText = useMemo(() => {
    if (isLoading) return 'La communauté grandit';
    if (membersCount <= 0) return 'Les premiers membres rejoignent l’Ekklesia';
    return `Déjà ${membersCount} membre${membersCount > 1 ? 's' : ''} ont rejoint l’Ekklesia`;
  }, [isLoading, membersCount]);

  return (
    <MainLayout statusText="Présentation">
      <div className="animate-in fade-in slide-in-from-bottom-4 space-y-20 pb-20 duration-1000 md:space-y-24">
        <section className="space-y-10 md:space-y-12">
          <div className="space-y-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
              Ekklesia
            </p>

            <h1 className="max-w-5xl text-5xl font-bold leading-[1.02] tracking-tight text-foreground md:text-7xl">
              Une assemblée
              <br />
              pour agir ensemble.
            </h1>

            <p className="max-w-3xl text-lg leading-relaxed text-muted-foreground md:text-2xl">
              Nous vivons une époque où tout semble fragmenté. L’Ekklesia est née pour
              rassembler celles et ceux qui veulent décider ensemble, chaque mois, de ce qui
              compte vraiment.
            </p>
          </div>

          <div className="flex flex-col gap-4 pt-2 sm:flex-row sm:items-center">
            {user && isActiveMember ? (
              <Link href="/assembly">
                <Button className="h-14 w-full rounded-full px-8 text-base font-semibold sm:w-auto">
                  <LayoutDashboard className="mr-2 h-5 w-5" />
                  Accéder à l&apos;assemblée
                </Button>
              </Link>
            ) : (
              <div className="space-y-3">
                <Link href="/login">
                  <Button className="h-14 w-full rounded-full px-8 text-base font-semibold sm:w-auto">
                    <LogIn className="mr-2 h-5 w-5" />
                    Rejoindre l&apos;Ekklesia
                  </Button>
                </Link>

                <p className="text-sm text-muted-foreground">
                  Adhésion à 10€ par mois. Chaque membre dispose d&apos;une voix.
                </p>
              </div>
            )}
          </div>
        </section>

        <section>
          <GlassCard intensity="soft" className="p-5 md:p-6">
            <div className="flex items-center justify-between gap-4">
              <div className="space-y-1">
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                  Communauté
                </p>
                <p className="max-w-xl text-lg font-semibold leading-snug text-foreground md:text-2xl">
                  {communityText}
                </p>
              </div>

              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full border border-white/60 bg-white/55 text-primary md:h-16 md:w-16">
                <Users className="h-6 w-6" />
              </div>
            </div>
          </GlassCard>
        </section>

        <section className="space-y-5">
          <div className="space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
              Projets en cours de soutien
            </p>

            <h2 className="text-2xl font-bold tracking-tight text-foreground md:text-3xl">
              Ce que l’assemblée peut faire émerger
            </h2>

            <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground md:text-base">
              Faites glisser pour découvrir quelques projets actuellement présentés à la
              communauté.
            </p>
          </div>

          {isLoading ? (
            <div className="flex gap-4 overflow-x-auto pb-2">
              {[...Array(3)].map((_, index) => (
                <GlassCard
                  key={index}
                  intensity="soft"
                  className="min-w-[280px] animate-pulse p-0 md:min-w-[340px]"
                >
                  <div className="aspect-[16/10] w-full bg-white/30" />
                  <div className="space-y-3 p-5 md:p-6">
                    <div className="h-5 w-2/3 rounded-full bg-white/40" />
                    <div className="h-4 w-1/3 rounded-full bg-white/30" />
                  </div>
                </GlassCard>
              ))}
            </div>
          ) : projects.length > 0 ? (
            <div className="flex snap-x snap-mandatory gap-4 overflow-x-auto pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {projects.map((project) => (
                <article
                  key={project.id}
                  className="group min-w-[280px] snap-start overflow-hidden rounded-[28px] border border-white/60 bg-white/40 backdrop-blur-md transition-all duration-300 md:min-w-[340px]"
                >
                  <div className="relative aspect-[16/10] w-full overflow-hidden bg-secondary/20">
                    {project.imageUrl ? (
                      <Image
                        src={project.imageUrl}
                        alt={project.title}
                        fill
                        className="object-cover grayscale transition-all duration-700 group-hover:scale-[1.03] group-hover:grayscale-0"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                        <Landmark className="h-12 w-12 opacity-20" />
                      </div>
                    )}

                    {project.budget ? (
                      <div className="absolute left-4 top-4 rounded-full border border-white/70 bg-white/85 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-foreground shadow-sm backdrop-blur-md">
                        {project.budget}
                      </div>
                    ) : null}

                    <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/10 via-transparent to-white/5" />
                  </div>

                  <div className="space-y-4 p-5 md:p-6">
                    <h3 className="line-clamp-2 text-xl font-semibold leading-tight tracking-tight text-foreground">
                      {project.title}
                    </h3>

                    <p className="line-clamp-2 text-sm leading-relaxed text-muted-foreground">
                      {project.summary}
                    </p>

                    <div className="inline-flex items-center gap-2 text-sm font-medium text-primary">
                      <span>Projet présenté à l’assemblée</span>
                      <MoveRight className="h-4 w-4" />
                    </div>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <GlassCard intensity="soft" className="p-6">
              <p className="text-sm text-muted-foreground">
                Les premiers projets apparaîtront ici prochainement.
              </p>
            </GlassCard>
          )}
        </section>

        <section className="max-w-3xl space-y-6">
          <p className="text-lg leading-relaxed text-foreground">
            Partout, des femmes et des hommes réparent, éduquent, soignent, inventent. Souvent
            seuls, souvent invisibles, ils portent déjà le monde d’après.
          </p>

          <p className="text-lg leading-relaxed text-muted-foreground">
            L’Ekklesia est née pour les rassembler. Pour faire de ces gestes dispersés une force
            commune, simple, concrète et démocratique.
          </p>
        </section>

        <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <GlassCard intensity="soft" className="p-6 md:p-7">
            <div className="space-y-3">
              <h3 className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                10€ / mois
              </h3>
              <p className="text-base leading-relaxed text-foreground">
                Une adhésion simple pour participer durablement aux décisions collectives.
              </p>
            </div>
          </GlassCard>

          <GlassCard intensity="soft" className="p-6 md:p-7">
            <div className="space-y-3">
              <h3 className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                1 membre = 1 voix
              </h3>
              <p className="text-base leading-relaxed text-foreground">
                Chaque voix compte autant que les autres, indépendamment de la contribution.
              </p>
            </div>
          </GlassCard>

          <GlassCard intensity="soft" className="p-6 md:p-7">
            <div className="space-y-3">
              <h3 className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                Décisions mensuelles
              </h3>
              <p className="text-base leading-relaxed text-foreground">
                Chaque mois, l’assemblée choisit ensemble les projets à soutenir.
              </p>
            </div>
          </GlassCard>
        </section>

        <section className="max-w-2xl space-y-5">
          <p className="text-lg leading-relaxed text-foreground">
            Rejoindre l’Ekklesia, c’est refuser le cynisme. C’est choisir d’agir ensemble, pas
            chacun dans son coin.
          </p>

          <p className="text-sm uppercase tracking-[0.22em] text-muted-foreground">
            Prendre la parole. Voter. Construire.
          </p>
        </section>
      </div>
    </MainLayout>
  );
}