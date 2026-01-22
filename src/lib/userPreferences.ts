import { getServerSession } from "next-auth/next";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { normalizeDateFormat, type DateFormat } from "@/lib/dateFormat";

export async function getCurrentUserDateFormat(): Promise<DateFormat> {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;
  if (!userId) return "ISO";

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { dateFormat: true },
    });

    return normalizeDateFormat((user as any)?.dateFormat);
  } catch (err) {
    // If the DB hasn't applied the migration yet, Prisma will throw P2022 (unknown column).
    if ((err as any)?.code === "P2022") {
      return "ISO";
    }

    // If Prisma Client was generated from an older schema, selecting `dateFormat`
    // will throw a validation error before even hitting the DB.
    if (
      (err as any)?.name === "PrismaClientValidationError" &&
      typeof (err as any)?.message === "string" &&
      (err as any).message.includes("Unknown field `dateFormat`")
    ) {
      return "ISO";
    }
    throw err;
  }
}
