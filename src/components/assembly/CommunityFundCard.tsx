'use client';

import { GlassCard } from '@/components/ui/glass-card';
import { cn } from '@/lib/utils';

type Props = {
  amount: number;
  monthlyDelta?: number;
  distributionLabel?: string;
};

function formatEuro(value: number) {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(value);
}

export function CommunityFundCard({
  amount,
  monthlyDelta = 0,
  distributionLabel = 'à répartir en fin de mois',
}: Props) {
  const deltaPositive = monthlyDelta >= 0;

  return (
    <GlassCard intensity="strong" className="w-full p-4 md:p-5">
      <div className="flex flex-col gap-3">
        <div className="flex items-start justify-between gap-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.26em] text-muted-foreground">
            Cagnotte commune
          </p>

          <div
            className={cn(
              'inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold',
              deltaPositive
                ? 'border-emerald-200/80 bg-emerald-50/80 text-emerald-700'
                : 'border-rose-200/80 bg-rose-50/80 text-rose-600'
            )}
          >
            {deltaPositive ? '+' : ''}
            {formatEuro(monthlyDelta)} ce mois
          </div>
        </div>

        <div className="space-y-1.5">
          <p className="text-4xl font-bold leading-none text-foreground md:text-5xl">
            {formatEuro(amount)}
          </p>
          <p className="text-sm text-muted-foreground">{distributionLabel}</p>
        </div>
      </div>
    </GlassCard>
  );
}

export default CommunityFundCard;