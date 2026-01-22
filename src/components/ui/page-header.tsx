import * as React from "react";

import { cn } from "@/lib/cn";

type Props = {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  className?: string;
};

export function PageHeader({ title, subtitle, actions, className }: Props) {
  return (
    <header className={cn("flex items-center justify-between mb-6", className)}>
      <div>
        <h1 className="text-xl font-semibold text-slate-900">{title}</h1>
        {subtitle ? (
          <div className="mt-1 text-xs text-slate-500">{subtitle}</div>
        ) : null}
      </div>
      <div className="flex items-center gap-2">{actions}</div>
    </header>
  );
}
