import * as React from "react";
import { cn } from "@/lib/utils";

export function Input({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "flex h-10 w-full rounded-[var(--radius-sm)] border border-neutral-200 bg-white px-3 py-1 text-sm shadow-sm transition-all placeholder:text-neutral-400 hover:border-neutral-300 focus-visible:border-accent focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-accent-ring/20 disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    />
  );
}
