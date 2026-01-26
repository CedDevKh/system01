import * as React from "react";

import { cn } from "@/lib/cn";

type BadgeVariant = "neutral" | "success" | "warning" | "danger" | "info";

type Props = React.HTMLAttributes<HTMLSpanElement> & {
  variant?: BadgeVariant;
};

const VARIANT: Record<BadgeVariant, string> = {
  neutral: "bg-muted text-muted-foreground",
  success: "bg-green-100 text-green-700",
  warning: "bg-amber-100 text-amber-700",
  danger: "bg-red-100 text-red-700",
  info: "bg-blue-100 text-blue-700",
};

export function Badge({ variant = "neutral", className, ...props }: Props) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
        VARIANT[variant],
        className,
      )}
      {...props}
    />
  );
}
