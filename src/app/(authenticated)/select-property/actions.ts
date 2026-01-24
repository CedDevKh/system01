"use server";

import { getServerSession } from "next-auth/next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const ACTIVE_PROPERTY_COOKIE = "activePropertyId";

export async function selectProperty(formData: FormData) {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;

  if (!userId) {
    redirect("/api/auth/signin");
  }

  const propertyId = String(formData.get("propertyId") ?? "").trim();
  if (!propertyId) {
    throw new Error("Missing propertyId");
  }

  const membership = await prisma.propertyUser.findFirst({
    where: {
      userId,
      propertyId,
      property: { isActive: true },
    },
    select: { propertyId: true },
  });

  if (!membership) {
    throw new Error("Forbidden");
  }

  const store = await cookies();
  store.set({ name: ACTIVE_PROPERTY_COOKIE, value: propertyId, path: "/" });
  redirect("/dashboard");
}
