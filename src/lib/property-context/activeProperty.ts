import { redirect } from "next/navigation";
import { getServerSession } from "next-auth/next";
import { cookies } from "next/headers";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const ACTIVE_PROPERTY_COOKIE = "activePropertyId";

export async function getActivePropertyIdForRequest() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return null;

  const store = await cookies();
  const value = store.get(ACTIVE_PROPERTY_COOKIE)?.value ?? null;
  return value || null;
}

export async function requireActivePropertyId() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    redirect("/api/auth/signin");
  }

  const activePropertyId = await getActivePropertyIdForRequest();
  if (!activePropertyId) {
    redirect("/select-property");
  }

  // Ensure the selected property is still active.
  const property = await prisma.property.findFirst({
    where: { id: activePropertyId, isActive: true },
    select: { id: true },
  });

  if (!property) {
    redirect("/select-property");
  }

  return activePropertyId;
}

export async function setActivePropertyForCurrentSession(propertyId: string) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    redirect("/api/auth/signin");
  }

  // Must be a property the user belongs to, and it must be active.
  const membership = await prisma.propertyUser.findFirst({
    where: {
      userId: (session.user as any).id,
      propertyId,
      property: { isActive: true },
    },
    select: { propertyId: true },
  });

  if (!membership) {
    const err = new Error("Forbidden");
    (err as any).status = 403;
    throw err;
  }

  const store = await cookies();
  store.set({
    name: ACTIVE_PROPERTY_COOKIE,
    value: propertyId,
    httpOnly: true,
    sameSite: "lax",
    path: "/",
  });
}
