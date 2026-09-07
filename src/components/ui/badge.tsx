import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium tracking-tight",
  {
    variants: {
      variant: {
        default: "bg-neutral-100 text-neutral-700 border-neutral-200",
        info: "bg-blue-50 text-blue-700 border-blue-200",
        low: "bg-yellow-50 text-yellow-700 border-yellow-200",
        medium: "bg-orange-50 text-orange-700 border-orange-200",
        high: "bg-red-50 text-red-700 border-red-200",
        critical: "bg-red-600 text-white border-red-600",
        success: "bg-emerald-50 text-emerald-700 border-emerald-200",
        accent: "bg-accent-soft text-accent-soft-foreground border-accent-soft",
      },
    },
    defaultVariants: { variant: "default" },
  }
);

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant, className }))} {...props} />;
}

export function severityToBadgeVariant(sev: string): BadgeProps["variant"] {
  switch (sev) {
    case "INFO": return "info";
    case "LOW": return "low";
    case "MEDIUM": return "medium";
    case "HIGH": return "high";
    case "CRITICAL": return "critical";
    default: return "default";
  }
}
