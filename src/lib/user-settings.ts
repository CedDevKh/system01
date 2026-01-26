import { ThemePreference } from "@prisma/client";

import { prisma } from "@/lib/prisma";

export async function getOrCreateUserSettings(userId: string) {
  const existing = await prisma.userSettings.findUnique({ where: { userId } });
  if (existing) return existing;

  return prisma.userSettings.create({
    data: { userId, theme: ThemePreference.SYSTEM },
  });
}

export async function updateUserTheme(userId: string, theme: ThemePreference) {
  return prisma.userSettings.upsert({
    where: { userId },
    update: { theme },
    create: { userId, theme },
  });
}
