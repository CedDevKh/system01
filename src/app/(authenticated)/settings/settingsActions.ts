'use server';

import { auth } from "@/auth";
import { ThemePreference } from "@prisma/client";
import { getOrCreateUserSettings, updateUserTheme } from "@/lib/user-settings";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export async function loadSettingsForSettingsPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/api/auth/signin");
  }

  const settings = await getOrCreateUserSettings(session.user.id);
  return { theme: settings.theme };
}

export async function updateThemeAction(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/api/auth/signin");
  }

  const raw = formData.get("theme");
  const theme =
    raw === "LIGHT" || raw === "DARK" || raw === "SYSTEM"
      ? (raw as ThemePreference)
      : ThemePreference.SYSTEM;

  await updateUserTheme(session.user.id, theme);

  const cookieStore = await cookies();
  cookieStore.set("uo-theme", theme, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
}
