'use client';

import { GlassCard } from '@/components/ui/glass-card';

export function CommunityFundCard() {
  return (
    <GlassCard intensity="strong" className="w-full p-4 md:p-5">
      <div className="flex flex-col gap-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.26em] text-muted-foreground">
          Cagnotte commune
        </p>
        <p className="text-sm text-muted-foreground">
          Données financières bientôt disponibles
        </p>
      </div>
    </GlassCard>
  );
}

export default CommunityFundCard;
