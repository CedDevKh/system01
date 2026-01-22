import { getServerSession } from "next-auth/next";
import { cookies } from "next/headers";

import { authOptions } from "@/lib/auth";
import { getUserRoleForProperty } from "@/lib/rbac";

const ACTIVE_PROPERTY_COOKIE = "activePropertyId";

export async function requireActivePropertyScope() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    const err = new Error("Unauthorized");
    (err as any).status = 401;
    throw err;
  }

  const store = await cookies();
  const activePropertyId = store.get(ACTIVE_PROPERTY_COOKIE)?.value ?? null;
  if (!activePropertyId) {
    const err = new Error("No active property in session");
    (err as any).status = 400;
    throw err;
  }

  const role = await getUserRoleForProperty({
    userId: session.user.id,
    propertyId: activePropertyId,
  });

  if (!role) {
    const err = new Error("Forbidden");
    (err as any).status = 403;
    throw err;
  }

  return {
    user: session.user,
    activePropertyId,
    role,
  };
}

export function assertPropertyMatch(
  paramPropertyId: string,
  activePropertyId: string,
) {
  if (paramPropertyId !== activePropertyId) {
    const err = new Error("Forbidden");
    (err as any).status = 403;
    throw err;
  }
}
