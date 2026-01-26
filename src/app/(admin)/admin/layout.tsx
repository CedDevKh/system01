import type { ReactNode } from "react";

import { requireSuperAdmin } from "@/lib/adminContext";

export default async function AdminLayout({
  children,
}: {
  children: ReactNode;
}) {
  await requireSuperAdmin();

  return (
    <div className="min-h-screen bg-muted">
      <main className="mx-auto max-w-6xl px-6 py-10">{children}</main>
    </div>
  );
}
