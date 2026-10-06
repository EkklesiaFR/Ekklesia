'use client';

import { GlassCard } from '@/components/ui/glass-card';
import Link from 'next/link';
import { usePublicFinance } from '@/hooks/use-public-finance';
import { formatEuro } from '@/lib/finance/public';

export function CommunityFundCard() {
  const { data, error, isLoading } = usePublicFinance();
  return (
    <Link href="/cagnotte" className="block rounded-card-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary">
      <GlassCard intensity="strong" className="w-full p-4 md:p-5">
        <div className="flex flex-col gap-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.26em] text-muted-foreground">
            Cagnotte commune
          </p>
          {error || data?.status === 'unavailable' ? (
            <p role="status" className="text-sm text-muted-foreground">Données financières indisponibles</p>
          ) : isLoading || !data ? (
            <p role="status" className="text-sm text-muted-foreground">Chargement de la cagnotte…</p>
          ) : (
            <>
              <p className="text-3xl font-bold">{formatEuro(data.availableMinor)}</p>
              <p className="text-sm text-muted-foreground">Disponible pour les projets</p>
            </>
          )}
          <span className="text-sm text-primary">Voir le registre →</span>
        </div>
      </GlassCard>
    </Link>
  );
}

export default CommunityFundCard;
