import { prisma } from "@/lib/prisma";

export async function getUserRoleForProperty(params: {
  userId: string;
  propertyId: string;
}) {
  const membership = await prisma.propertyUser.findUnique({
    where: {
      propertyId_userId: {
        propertyId: params.propertyId,
        userId: params.userId,
      },
    },
    select: {
      role: true,
    },
  });

  return membership?.role ?? null;
}

export async function requireUserRoleForProperty(params: {
  userId: string;
  propertyId: string;
  allowedRoles: string[];
}) {
  const role = await getUserRoleForProperty({
    userId: params.userId,
    propertyId: params.propertyId,
  });

  if (!role || !params.allowedRoles.includes(role)) {
    const err = new Error("Forbidden");
    (err as any).status = 403;
    throw err;
  }

  return role;
}
