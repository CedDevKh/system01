import { redirect } from "next/navigation";
import { getServerSession } from "next-auth/next";
import { cookies } from "next/headers";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const ACTIVE_PROPERTY_COOKIE = "activePropertyId";

export async function setActivePropertyId(propertyId: string) {
  const store = await cookies();
  store.set({ name: ACTIVE_PROPERTY_COOKIE, value: propertyId, path: "/" });
}

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
