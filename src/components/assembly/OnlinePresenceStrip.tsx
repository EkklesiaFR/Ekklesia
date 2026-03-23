'use client';

import { Users } from 'lucide-react';
import { GlassCard } from '@/components/ui/glass-card';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

type OnlineMember = {
  uid: string;
  displayName?: string | null;
  photoURL?: string | null;
};

type Props = {
  onlineCount: number;
  totalCount?: number | null;
  deltaLastMinute?: number;
  isLoading?: boolean;
  onlineMembers?: OnlineMember[];
};

function getInitials(displayName?: string | null) {
  if (!displayName) return '?';

  const initials = displayName
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((name) => name[0])
    .join('')
    .toUpperCase();

  return initials.length > 2 ? initials.slice(0, 2) : initials;
}

export function OnlinePresenceStrip({
  onlineCount,
  totalCount = null,
  deltaLastMinute = 0,
  isLoading = false,
  onlineMembers = [],
}: Props) {
  const safeTotal = typeof totalCount === 'number' && totalCount > 0 ? totalCount : null;

  const deltaLabel =
    deltaLastMinute > 0 ? `+${deltaLastMinute}` : deltaLastMinute < 0 ? `${deltaLastMinute}` : '0';

  const deltaClasses =
    deltaLastMinute > 0
      ? 'border-success/30 bg-success/10 text-success'
      : deltaLastMinute < 0
        ? 'border-live/30 bg-live/10 text-live'
        : 'border-border bg-background/60 text-muted-foreground';

  const displayedMembers = onlineMembers.slice(0, 4);
  const remainingMembersCount = Math.max(onlineMembers.length - 4, 0);

  return (
    <GlassCard className="w-full rounded-card-md p-5 md:p-6">
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary/12 text-primary">
            <Users className="h-5 w-5" />
          </div>

          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
              Présence en direct
            </p>
          </div>
        </div>

        {isLoading ? (
          <p className="text-sm text-text-soft">Chargement…</p>
        ) : (
          <div className="flex flex-col gap-3">
            <div className="flex items-baseline gap-x-2">
              <p className="text-3xl font-bold leading-none text-foreground">{onlineCount}</p>
              <span className="text-base text-muted-foreground">en ligne</span>
            </div>

            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
              <span
                className={cn(
                  'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold',
                  deltaClasses
                )}
              >
                {deltaLabel} / 1 min
              </span>

              {safeTotal ? (
                <span className="text-muted-foreground">
                  {onlineCount} sur {safeTotal} membres
                </span>
              ) : (
                <span className="text-muted-foreground">Activité en temps réel</span>
              )}
            </div>

            {onlineCount > 0 && (
              <div className="mt-1 flex items-center -space-x-2">
                {displayedMembers.map((member) => (
                  <Avatar
                    key={member.uid}
                    className="h-8 w-8 border-2 border-background shadow-soft"
                  >
                    <AvatarImage
                      src={member.photoURL || undefined}
                      alt={member.displayName || 'Membre'}
                    />
                    <AvatarFallback className="bg-muted text-[11px] font-semibold text-foreground">
                      {getInitials(member.displayName)}
                    </AvatarFallback>
                  </Avatar>
                ))}

                {remainingMembersCount > 0 && (
                  <div className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-background bg-muted text-[11px] font-semibold text-foreground shadow-soft">
                    +{remainingMembersCount}
                  </div>
                )}
              </div>
            )}

            {onlineCount === 0 && (
              <div className="mt-1 text-sm text-muted-foreground">
                Aucun membre en ligne pour l&apos;instant.
              </div>
            )}
          </div>
        )}
      </div>
    </GlassCard>
  );
}

export default OnlinePresenceStrip;