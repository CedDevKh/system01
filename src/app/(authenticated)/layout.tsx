import type { ReactNode } from "react";

import Link from "next/link";
import { requireActiveProperty } from "@/lib/propertyContext";

import SidebarNav from "./_components/SidebarNav";

export default async function AuthenticatedLayout({
  children,
}: {
  children: ReactNode;
}) {
  const { user, property } = await requireActiveProperty();
  const displayName = user?.email ?? user?.name ?? "User";

  return (
    <div className="flex min-h-screen bg-slate-50">
      <aside className="hidden md:flex md:w-60 flex-col border-r border-black/10 bg-white">
        <div className="h-14 border-b border-black/10 px-4 flex items-center">
          <div>
            <div className="text-sm font-semibold">PMS Console</div>
            <div className="text-xs text-black/60">{property.name}</div>
          </div>
        </div>

        <SidebarNav />

        <div className="border-t border-black/10 p-2">
          <Link
            className="block rounded-md px-3 py-2 text-sm text-black/70 hover:bg-black/[0.03]"
            href="/api/auth/signout?callbackUrl=/"
          >
            Sign out
          </Link>
        </div>
      </aside>

      <div className="flex-1 min-w-0 flex flex-col">
        <header className="h-14 border-b border-black/10 bg-white flex items-center justify-between px-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="text-sm font-semibold">PMS Console</div>
            <div className="hidden sm:block text-sm text-black/70 truncate">
              <span className="text-black/60">Property:</span> {property.name}
            </div>
            <Link className="text-sm underline text-black/70" href="/select-property">
              Switch
            </Link>
          </div>

          <div className="flex items-center gap-3 text-sm text-black/70">
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
