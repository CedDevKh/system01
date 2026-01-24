import { getServerSession } from "next-auth/next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { PropertyUserRole } from "@prisma/client";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const ACTIVE_PROPERTY_COOKIE = "activePropertyId";

export type PropertyMembership = {
  role: PropertyUserRole;
};

export async function getActivePropertyContext() {
  const session = await getServerSession(authOptions);
  const user = session?.user;
  const userId = user?.id;

  if (!userId || !user) {
    redirect("/api/auth/signin");
  }

  const memberships = (await prisma.propertyUser.findMany({
    where: {
      userId,
      property: { isActive: true },
    },
    select: {
      role: true,
      property: {
        select: {
          id: true,
          name: true,
          timezone: true,
          currency: true,
          type: true,
        },
      },
    },
    orderBy: { createdAt: "asc" },
  } as any)) as unknown as Array<{
    role: PropertyUserRole;
    property: {
      id: string;
      name: string;
      timezone: string;
      currency: string;
      type: any;
    };
  }>;

  if (memberships.length === 0) {
    redirect("/setup/property");
  }

  const store = await cookies();
  const activePropertyId = store.get(ACTIVE_PROPERTY_COOKIE)?.value ?? null;

  if (!activePropertyId) {
    redirect("/select-property");
  }

  const activeMembership = memberships.find((m) => m.property.id === activePropertyId);

  if (!activeMembership) {
    redirect("/select-property");
  }

  const membership: PropertyMembership = { role: activeMembership.role };

  return {
    activePropertyId,
    user,
    property: activeMembership.property,
    membership,
    memberships,
  };
}

export async function requireActiveProperty() {
  const { user, property, membership } = await getActivePropertyContext();
  return { user, property, role: membership.role };
}

export function canManageStays(membership: PropertyMembership | null | undefined) {
  if (!membership) return false;
  return membership.role === "OWNER" || membership.role === "MANAGER";
}

export function canViewStays(membership: PropertyMembership | null | undefined) {
  return Boolean(membership);
}
