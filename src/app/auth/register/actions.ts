"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { setActivePropertyId } from "@/lib/property-context/activeProperty";

export type RegisterOwnerState = {
  ok: boolean;
  error?: string;
};

export const initialRegisterOwnerState: RegisterOwnerState = { ok: false };

const SALT_ROUNDS = 12;

function isValidEmail(email: string) {
  // Simple, pragmatic check.
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export async function registerOwner(
  _prevState: RegisterOwnerState,
  formData: FormData,
): Promise<RegisterOwnerState> {
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").toLowerCase().trim();
  const password = String(formData.get("password") ?? "");
  const propertyName = String(formData.get("propertyName") ?? "").trim();

  if (!name || !email || !password || !propertyName) {
    return { ok: false, error: "Please fill in all required fields" };
  }

  if (!isValidEmail(email)) {
    return { ok: false, error: "Please enter a valid email address" };
  }

  if (password.length < 8) {
    return { ok: false, error: "Password must be at least 8 characters" };
  }

  const existing = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  });

  if (existing) {
    return { ok: false, error: "Email is already in use" };
  }

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

  try {
    const { property } = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          name,
          email,
          passwordHash,
          isSuperAdmin: false,
        },
        select: { id: true },
      });

      const property = await tx.property.create({
        data: {
          name: propertyName,
        },
        select: { id: true },
      });

      await tx.propertyUser.create({
        data: {
          userId: user.id,
          propertyId: property.id,
          role: "OWNER",
        },
        select: { id: true },
      });

      return { property };
    });

    await setActivePropertyId(property.id);

    redirect("/dashboard");
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError) {
      // Unique constraint (race condition, etc.)
      if (err.code === "P2002") {
        return { ok: false, error: "Email is already in use" };
      }
    }

    return { ok: false, error: "Could not create account. Please try again." };
  }

  // Unreachable (redirect throws), but keeps the return type happy.
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  return { ok: true };
}
