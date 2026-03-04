'use client';

import Link from 'next/link';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';

type Props = {
  onlineCount: number;
  totalCount?: number | null;
  deltaLastMinute?: number;
  isLoading?: boolean;
  href?: string;
};

export function OnlinePresenceStrip({
  onlineCount,
  totalCount = null,
  deltaLastMinute = 0,
  isLoading = false,
  href = '/vote',
}: Props) {
  const safeTotal = typeof totalCount === 'number' && totalCount > 0 ? totalCount : null;
  const pct = safeTotal ? Math.round((onlineCount / safeTotal) * 100) : 0;

  const deltaLabel =
    deltaLastMinute > 0 ? `+${deltaLastMinute}` : deltaLastMinute < 0 ? `${deltaLastMinute}` : '0';

  return (
    <div className="w-full border border-border bg-black text-white px-6 py-5">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="space-y-1">
          <p className="text-[10px] uppercase font-bold tracking-widest text-white/60">
            Présence en direct
          </p>

          {isLoading ? (
            <p className="text-sm text-white/70">Chargement…</p>
          ) : (
            <div className="flex items-baseline gap-3 flex-wrap">
              <p className="text-xl font-black">
                {onlineCount}
                <span className="text-white/70 font-bold"> en ligne</span>
                {safeTotal ? <span className="text-white/50 font-bold"> / {safeTotal}</span> : null}
              </p>

              <span
                className={cn(
                  'text-[11px] font-black px-2 py-1 border',
                  deltaLastMinute > 0
                    ? 'border-emerald-400/40 text-emerald-300'
                    : deltaLastMinute < 0
                      ? 'border-rose-400/40 text-rose-300'
                      : 'border-white/20 text-white/60'
                )}
              >
                {deltaLabel} / 1 min
              </span>

              {safeTotal ? (
                <span className="text-[11px] font-black text-white/80">{pct}%</span>
              ) : null}
            </div>
          )}
        </div>

        <div className="flex items-center gap-4">
          <div className="w-full md:w-[260px]">
            <Progress value={pct} className="h-2 rounded-none bg-white/10" />
          </div>

          <Link
            href={href}
            className="text-xs uppercase font-bold tracking-widest text-white/90 hover:underline whitespace-nowrap"
          >
            Ouvrir →
          </Link>
        </div>
      </div>
    </div>
  );
}

export default OnlinePresenceStrip;