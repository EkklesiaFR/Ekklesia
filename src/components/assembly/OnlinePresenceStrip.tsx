'use client';

import { GlassCard } from '@/components/ui/glass-card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';

type OnlineMember = {
  uid: string;
  displayName?: string | null;
  photoURL?: string | null;
};

type Props = {
  onlineCount: number;
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

function getLiveCopy(onlineCount: number, deltaLastMinute: number) {
  if (deltaLastMinute > 1) return `+${deltaLastMinute} membres ont rejoint l’assemblée`;
  if (deltaLastMinute === 1) return `+1 membre a rejoint l’assemblée`;
  if (deltaLastMinute < -1) return `${Math.abs(deltaLastMinute)} membres se sont déconnectés`;
  if (deltaLastMinute === -1) return `1 membre s’est déconnecté`;
  if (onlineCount > 1) return `${onlineCount} membres actifs maintenant`;
  if (onlineCount === 1) return `1 membre actif maintenant`;
  return `Aucun membre en ligne pour l’instant`;
}

export function OnlinePresenceStrip({
  onlineCount,
  deltaLastMinute = 0,
  isLoading = false,
  onlineMembers = [],
}: Props) {
  const displayedMembers = onlineMembers.slice(0, 4);
  const remainingMembersCount = Math.max(onlineMembers.length - 4, 0);

  return (
    <GlassCard intensity="medium" className="relative w-full p-4 md:p-5">
      <div className="absolute right-4 top-4 md:right-5 md:top-5">
        <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200/80 bg-emerald-50/80 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-[0.22em] text-emerald-700">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
          </span>
          Live
        </div>
      </div>

      <div className="flex flex-col gap-3 pr-24">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Chargement…</p>
        ) : (
          <>
            <div className="flex items-end gap-2">
              <p className="text-4xl font-bold leading-none text-foreground md:text-5xl">
                {onlineCount}
              </p>
              <span className="pb-0.5 text-lg text-muted-foreground">en ligne</span>
            </div>

            {onlineCount > 0 && (
              <div className="flex items-center -space-x-2">
                {displayedMembers.map((member) => (
                  <Avatar
                    key={member.uid}
                    className="h-8 w-8 border-2 border-white shadow-[0_4px_10px_rgba(15,23,42,0.10)]"
                  >
                    <AvatarImage
                      src={member.photoURL || undefined}
                      alt={member.displayName || 'Membre'}
                    />
                    <AvatarFallback className="bg-muted text-[10px] font-semibold text-foreground">
                      {getInitials(member.displayName)}
                    </AvatarFallback>
                  </Avatar>
                ))}

                {remainingMembersCount > 0 && (
                  <div className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-white bg-white/85 text-[10px] font-semibold text-foreground shadow-[0_4px_10px_rgba(15,23,42,0.10)]">
                    +{remainingMembersCount}
                  </div>
                )}
              </div>
            )}

            <p
              className={cn(
                'text-sm',
                deltaLastMinute > 0
                  ? 'text-emerald-700'
                  : deltaLastMinute < 0
                    ? 'text-rose-600'
                    : 'text-muted-foreground'
              )}
            >
              {getLiveCopy(onlineCount, deltaLastMinute)}
            </p>
          </>
        )}
      </div>
    </GlassCard>
  );
}

export default OnlinePresenceStrip;