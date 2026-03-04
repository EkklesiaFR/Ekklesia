'use client';

import { TrendingUp, BarChart3 } from 'lucide-react';
import { useAdminTrends } from '@/hooks/useAdminTrends';

interface AdminTrendsPanelProps {
  assemblyId: string;
  voteId: string;
}

/**
 * Version scalable :
 * - Ne LIST plus /ballots côté client
 * - Appelle une API admin sécurisée (cookie session)
 * - Polling + cache côté serveur
 */
export function AdminTrendsPanel({ assemblyId, voteId }: AdminTrendsPanelProps) {
  const { trends, isLoading, error } = useAdminTrends(assemblyId, voteId);

  const winnerTitle =
    trends?.winnerProject?.title ?? trends?.winnerId ?? '—';

  const winnerImg = trends?.winnerProject?.imageUrl ?? null;

  if (isLoading && !trends) {
    return (
      <div className="bg-secondary/30 p-6 border space-y-4 animate-pulse">
        <div className="h-4 bg-muted rounded w-2/3" />
        <div className="h-10 bg-muted rounded w-1/2" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-secondary/30 p-6 border space-y-3">
        <div className="flex items-center gap-3">
          <TrendingUp className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-xs font-bold uppercase tracking-widest">Tendance live (Admin)</h3>
        </div>
        <p className="text-sm text-muted-foreground">
          Impossible de charger la tendance (admin only).
        </p>
      </div>
    );
  }

  // Pas encore de bulletins
  if (!trends || trends.ballotCount === 0) {
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
            alt={trends?.winnerProject?.title ? `Image de ${trends.winnerProject.title}` : 'Image projet'}
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
          <p className="text-lg font-bold truncate">{winnerTitle}</p>
        </div>
      </div>

      <div className="text-xs text-muted-foreground pt-2 border-t border-black/5">
        Basé sur {trends.ballotCount} bulletin(s). Le classement peut évoluer.
      </div>
    </div>
  );
}