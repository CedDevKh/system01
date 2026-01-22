import * as React from "react";

import { cn } from "@/lib/cn";

type DivProps = React.HTMLAttributes<HTMLDivElement>;

type HeadingProps = React.HTMLAttributes<HTMLHeadingElement>;

type ParagraphProps = React.HTMLAttributes<HTMLParagraphElement>;

export function Card({ className, ...props }: DivProps) {
  return (
    <div
      className={cn("bg-white rounded-lg border border-slate-200", className)}
      {...props}
    />
  );
}

export function CardHeader({ className, ...props }: DivProps) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-2 border-b border-slate-100 px-4 py-3",
        className,
      )}
      {...props}
    />
  );
}

export function CardTitle({ className, ...props }: HeadingProps) {
  return (
    <h3 className={cn("text-sm font-semibold text-slate-800", className)} {...props} />
  );
}

export function CardDescription({ className, ...props }: ParagraphProps) {
  return (
    <p className={cn("text-xs text-slate-500", className)} {...props} />
  );
}

export function CardContent({ className, ...props }: DivProps) {
  return <div className={cn("p-4", className)} {...props} />;
}
