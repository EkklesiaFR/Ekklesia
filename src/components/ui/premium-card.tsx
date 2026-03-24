import * as React from "react";
import { cn } from "@/lib/utils";

type PremiumCardProps = React.HTMLAttributes<HTMLDivElement>;

export function PremiumCard({
  className,
  children,
  ...props
}: PremiumCardProps) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-card-md border bg-card text-card-foreground shadow-medium",
        "border-border",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}