"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

function classNames(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

function isActivePath(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

function NavItem({ href, label }: { href: string; label: string }) {
  const pathname = usePathname();
  const active = isActivePath(pathname, href);

  return (
    <Link
      href={href}
      className={classNames(
        "block rounded-md px-3 py-2",
        active
          ? "bg-muted font-medium text-foreground"
          : "text-muted-foreground hover:bg-muted hover:text-foreground",
      )}
      aria-current={active ? "page" : undefined}
    >
      {label}
    </Link>
  );
}

function NavPlaceholder({ label }: { label: string }) {
  return (
    <span className="block rounded-md px-3 py-2 text-muted-foreground/60 cursor-not-allowed">
      {label}
    </span>
  );
}

export default function SidebarNav() {
  return (
    <nav className="flex-1 p-2 text-sm">
      <div className="px-3 pt-2 pb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        App
      </div>
      <NavItem href="/dashboard" label="Dashboard" />

      <div className="px-3 pt-4 pb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        PMS
      </div>
      <NavItem href="/pms/stays" label="Stays" />
      <NavItem href="/pms/availability" label="Availability" />
      <NavItem href="/pms/rooms" label="Rooms" />
      <NavItem href="/pms/room-types" label="Room types" />
      <NavItem href="/pms/rates" label="Rates" />
      <NavItem href="/pms/reports/daily" label="Reports" />
      <NavItem href="/pms/guests" label="Guests" />
      <NavItem href="/pms/housekeeping" label="Housekeeping" />

      <div className="px-3 pt-4 pb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        POS
      </div>
      <NavItem href="/pos" label="POS" />

      <div className="px-3 pt-4 pb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Settings
      </div>
      <NavItem href="/settings" label="Settings" />
    </nav>
  );
}
