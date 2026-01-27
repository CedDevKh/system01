import { getServerSession } from "next-auth/next";
import { redirect } from "next/navigation";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function requireSuperAdmin() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    redirect("/api/auth/signin?callbackUrl=/admin");
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
  });

  if (!user) {
    redirect("/api/auth/signin?callbackUrl=/admin");
  }

  if (!user.isSuperAdmin) {
    // Bootstrap behavior: if there is no super admin yet, promote the first OWNER.
    // This avoids getting locked out when the initial account is created via /auth/register.
    const superAdminExists = await prisma.user.findFirst({
      where: { isSuperAdmin: true },
      select: { id: true },
    });

    if (!superAdminExists) {
      const isOwnerSomewhere = await prisma.propertyUser.findFirst({
        where: { userId: user.id, role: "OWNER" },
        select: { id: true },
      });

      if (isOwnerSomewhere) {
        const promoted = await prisma.user.update({
          where: { id: user.id },
          data: { isSuperAdmin: true },
        });
        return promoted;
      }
    }

    redirect("/dashboard");
  }

  return user;
}
