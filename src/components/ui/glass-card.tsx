import * as React from 'react';
import { cn } from '@/lib/utils';

type GlassCardProps = React.HTMLAttributes<HTMLDivElement> & {
  intensity?: 'soft' | 'medium' | 'strong';
};

export function GlassCard({
  className,
  intensity = 'medium',
  children,
  ...props
}: GlassCardProps) {
  const intensityClasses = {
    soft: 'bg-white/55 backdrop-blur-xl',
    medium: 'bg-white/62 backdrop-blur-2xl',
    strong: 'bg-white/72 backdrop-blur-3xl',
  };

  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-card-lg',
        'border border-white/50',
        'shadow-[0_12px_40px_rgba(15,23,42,0.08),0_2px_8px_rgba(15,23,42,0.04)]',
        intensityClasses[intensity],
        className
      )}
      {...props}
    >
      <div
        className={cn(
          'pointer-events-none absolute inset-0',
          'bg-[linear-gradient(180deg,rgba(255,255,255,0.72)_0%,rgba(255,255,255,0.22)_22%,rgba(255,255,255,0.06)_52%,rgba(255,255,255,0.12)_100%)]'
        )}
      />
      <div
        className={cn(
          'pointer-events-none absolute inset-x-0 top-0 h-px',
          'bg-white/80'
        )}
      />
      <div
        className={cn(
          'pointer-events-none absolute -top-12 left-8 h-24 w-40 rounded-full',
          'bg-white/35 blur-2xl'
        )}
      />
      <div className="relative z-10">{children}</div>
    </div>
  );
}

export default GlassCard;