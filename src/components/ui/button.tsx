import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[var(--radius-sm)] text-sm font-semibold transition-all duration-200 disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-accent-ring active:scale-[0.98]",
  {
    variants: {
      variant: {
        default: "bg-accent text-accent-foreground shadow-[0_1px_2px_rgb(49_46_129_/_0.2),0_6px_16px_rgb(79_70_229_/_0.16)] hover:-translate-y-0.5 hover:bg-accent-hover hover:shadow-[0_8px_20px_rgb(79_70_229_/_0.22)]",
        neutral: "bg-neutral-900 text-white shadow-sm hover:-translate-y-0.5 hover:bg-neutral-800",
        destructive: "bg-red-600 text-white shadow-sm hover:bg-red-700",
        outline: "border border-neutral-200 bg-white text-neutral-700 shadow-sm hover:-translate-y-0.5 hover:border-neutral-300 hover:bg-neutral-50 hover:text-neutral-950",
        ghost: "text-neutral-700 hover:bg-neutral-100",
        warning: "bg-amber-500 text-white shadow-sm hover:bg-amber-600",
        link: "text-accent underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 px-4 py-2",
        sm: "h-8 px-3 text-xs",
        lg: "h-11 px-6",
        icon: "h-9 w-9",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export function Button({ className, variant, size, asChild, ...props }: ButtonProps) {
  const Comp = asChild ? Slot : "button";
  return <Comp className={cn(buttonVariants({ variant, size, className }))} {...props} />;
}
