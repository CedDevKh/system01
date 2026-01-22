import { cookies } from "next/headers";
import { getServerSession } from "next-auth/next";
import { redirect } from "next/navigation";
import type { PropertyUserRole } from "@prisma/client";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const ACTIVE_PROPERTY_COOKIE = "activePropertyId";

export type PropertyMembership = {
  role: PropertyUserRole;
};

export async function requireActiveProperty() {
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

  const activeMembership =
    (activePropertyId
      ? memberships.find((m) => m.property.id === activePropertyId)
      : null) ?? memberships[0];

  if (!activePropertyId || activeMembership.property.id !== activePropertyId) {
    store.set({
      name: ACTIVE_PROPERTY_COOKIE,
      value: activeMembership.property.id,
      httpOnly: true,
      sameSite: "lax",
      path: "/",
    });
  }

  return {
    user,
    property: activeMembership.property,
    role: activeMembership.role,
  };
}

export async function getActivePropertyContext() {
  const { user, property, role } = await requireActiveProperty();
  const membership: PropertyMembership = { role };
  return { user, property, membership };
}

export function canManageStays(membership: PropertyMembership | null | undefined) {
  if (!membership) return false;
  return membership.role === "OWNER" || membership.role === "MANAGER";
}

export function canViewStays(membership: PropertyMembership | null | undefined) {
  return Boolean(membership);
}
