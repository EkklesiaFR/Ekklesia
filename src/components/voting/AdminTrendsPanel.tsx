'use client';

import { useMemo } from 'react';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { useAuthStatus } from '@/components/auth/AuthStatusProvider';
import { collection } from 'firebase/firestore';
import type { Ballot, Project } from '@/types';
import { computeSchulzeResults } from '@/lib/tally';
import { TrendingUp, BarChart3 } from 'lucide-react';

interface AdminTrendsPanelProps {
  assemblyId: string;
  voteId: string;
  projects: Project[];
}

/**
 * IMPORTANT : Ne doit être monté que côté admin.
 * Fait une LIST sur /ballots (donc coûteux si monté pour tout le monde).
 */
export function AdminTrendsPanel({ assemblyId, voteId, projects }: AdminTrendsPanelProps) {
  const { isAdmin, isMemberLoading } = useAuthStatus();
  const db = useFirestore();

  const ballotsQuery = useMemoFirebase(() => {
    // Sécurité: ne retourne une query QUE si admin actif (et profil chargé)
    if (!db || isMemberLoading || isAdmin !== true) return null;
    return collection(db, 'assemblies', assemblyId, 'votes', voteId, 'ballots');
  }, [db, assemblyId, voteId, isAdmin, isMemberLoading]);

  const { data: ballots, isLoading } = useCollection<Ballot>(ballotsQuery);

  const results = useMemo(() => {
    if (!ballots || projects.length === 0) return null;
    return computeSchulzeResults(projects.map((p) => p.id), ballots);
  }, [ballots, projects]);

  const winnerProject = useMemo(() => {
    if (!results?.winnerId) return null;
    return projects.find((p) => p.id === results.winnerId) ?? null;
  }, [results?.winnerId, projects]);

  // Fallbacks d'image (sans casser si la clé n'existe pas)
  const winnerImg =
    winnerProject
      ? ((winnerProject as any).imageUrl ??
        (winnerProject as any).coverImageUrl ??
        (winnerProject as any).thumbnailUrl ??
        null)
      : null;

  if (isLoading || isMemberLoading) {
    return (
      <div className="bg-secondary/30 p-6 border space-y-4 animate-pulse">
        <div className="h-4 bg-muted rounded w-2/3" />
        <div className="h-10 bg-muted rounded w-1/2" />
      </div>
    );
  }

  if (!results) {
    return (
      <div className="bg-secondary/30 p-6 border space-y-3">
        <div className="flex items-center gap-3">
          <TrendingUp className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-xs font-bold uppercase tracking-widest">Tendance live (Admin)</h3>
        </div>
        <p className="text-sm text-muted-foreground">En attente des premiers bulletins…</p>
      </div>
    );
  }

  return (
    <div className="bg-secondary/30 p-6 border space-y-4">
      <div className="flex items-center gap-3">
        <TrendingUp className="h-4 w-4 text-muted-foreground" />
        <h3 className="text-xs font-bold uppercase tracking-widest">Tendance live (Admin)</h3>
      </div>

      <div className="flex items-start gap-4">
        {winnerImg ? (
          <img
            src={winnerImg}
            alt={winnerProject?.title ? `Image de ${winnerProject.title}` : 'Image projet'}
            className="w-20 h-[60px] object-cover rounded-md border bg-white"
            loading="lazy"
          />
        ) : (
          <div className="w-20 h-[60px] bg-white/60 rounded-md border flex items-center justify-center">
            <BarChart3 className="h-6 w-6 text-muted-foreground/50" />
          </div>
        )}

        <div className="flex-1 min-w-0">
          <p className="text-sm text-muted-foreground">En tête</p>
          <p className="text-lg font-bold truncate">{winnerProject?.title ?? results.winnerId ?? '—'}</p>
        </div>
      </div>

      <div className="text-xs text-muted-foreground pt-2 border-t border-black/5">
        Basé sur {ballots?.length ?? 0} bulletin(s). Le classement peut évoluer.
      </div>
    </div>
  );
}