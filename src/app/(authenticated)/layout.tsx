import type { ReactNode } from "react";

import Link from "next/link";
import { getServerSession } from "next-auth/next";
import { redirect } from "next/navigation";

import { authOptions } from "@/lib/auth";
import { getActivePropertyContext } from "@/lib/propertyContext";

import SidebarNav from "./_components/SidebarNav";

export default async function AuthenticatedLayout({
  children,
}: {
  children: ReactNode;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    redirect("/api/auth/signin");
  }

  const { property } = await getActivePropertyContext();
  const displayName = session.user.email ?? session.user.name ?? "User";

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <aside className="hidden md:flex md:w-60 flex-col border-r border-border bg-card">
        <div className="h-14 border-b border-border px-4 flex items-center">
          <div>
            <div className="text-sm font-semibold">PMS Console</div>
            <div className="text-xs text-muted-foreground">{property.name}</div>
          </div>
        </div>

        <SidebarNav />

        <div className="border-t border-border p-2">
          <Link
            className="block rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
            href="/api/auth/signout?callbackUrl=/"
          >
            Sign out
          </Link>
        </div>
      </aside>

      <div className="flex-1 min-w-0 flex flex-col">
        <header className="h-14 border-b border-border bg-card flex items-center justify-between px-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="text-sm font-semibold">PMS Console</div>
            <div className="hidden sm:block text-sm text-muted-foreground truncate">
              <span className="text-muted-foreground">Property:</span> {property.name}
            </div>
            <Link className="text-sm underline text-muted-foreground" href="/select-property">
              Switch
            </Link>
          </div>

          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <span className="hidden sm:inline">{displayName}</span>
            <Link className="underline" href="/api/auth/signout?callbackUrl=/">
              Sign out
            </Link>
          </div>
        </header>

        <main className="flex-1 min-w-0 overflow-y-auto p-4">{children}</main>
      </div>
    </div>
  );
}
