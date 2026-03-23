import * as React from "react";
import { cn } from "@/lib/utils";

type GlassCardProps = React.HTMLAttributes<HTMLDivElement> & {
  intensity?: "soft" | "medium" | "strong";
};

export function GlassCard({
  className,
  intensity = "medium",
  children,
  ...props
}: GlassCardProps) {
  const intensityClasses = {
    soft: "bg-white/55 dark:bg-white/5 backdrop-blur-lg",
    medium: "bg-white/70 dark:bg-white/10 backdrop-blur-xl",
    strong: "bg-white/80 dark:bg-white/15 backdrop-blur-2xl",
  };

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-card-md border shadow-glass",
        "border-white/50 dark:border-white/15",
        intensityClasses[intensity],
        className
      )}
      {...props}
    >
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-white/60 via-white/10 to-transparent dark:from-white/15 dark:via-white/5 dark:to-transparent" />
      <div className="relative z-10">{children}</div>
    </div>
  );
}