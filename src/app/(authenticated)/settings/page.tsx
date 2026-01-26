import { prisma } from "@/lib/prisma";
import { requireActiveProperty } from "@/lib/propertyContext";
import { normalizeDateFormat, type DateFormat } from "@/lib/dateFormat";
import { PageHeader } from "@/components/ui/PageHeader";
import { loadSettingsForSettingsPage, updateThemeAction } from "./settingsActions";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default async function SettingsPage() {
  const { theme } = await loadSettingsForSettingsPage();
  const { property, user } = await requireActiveProperty();

  async function updateDateFormat(formData: FormData) {
    "use server";
    const { user } = await requireActiveProperty();

    const raw = String(formData.get("dateFormat") ?? "");
    const dateFormat = normalizeDateFormat(raw) as DateFormat;

    try {
      await prisma.user.update({
        where: { id: user.id },
        data: { dateFormat },
        select: { id: true },
      });
    } catch (err) {
      // If migration not applied yet, don't crash the whole settings page.
      if ((err as any)?.code === "P2022") return;
      throw err;
    }
  }

  let supportsDateFormat = true;
  let current: DateFormat = "ISO";
  try {
    const userWithPref = await prisma.user.findUnique({
      where: { id: user.id },
      select: { dateFormat: true },
    });
    current = normalizeDateFormat(userWithPref?.dateFormat);
  } catch (err) {
    if ((err as any)?.code === "P2022") {
      supportsDateFormat = false;
      current = "ISO";
    } else {
      throw err;
    }
  }

  return (
    <main className="p-6 space-y-6">
      <PageHeader title="Settings" subtitle="Configuration for this property and account." />

      <Card>
        <CardHeader className="items-start">
          <div>
            <CardTitle>User settings</CardTitle>
            <CardDescription>Personal preferences for your account.</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <form action={updateThemeAction} className="flex flex-col gap-4 max-w-sm">
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium">Theme</span>
              <select
                name="theme"
                defaultValue={theme}
                className="rounded-md border border-border bg-background px-2 py-1 text-sm text-foreground"
              >
                <option value="SYSTEM">System</option>
                <option value="LIGHT">Light</option>
                <option value="DARK">Dark</option>
              </select>
            </label>

            <div className="flex justify-end">
              <Button type="submit">Save</Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <div className="space-y-1">
        <div className="text-sm font-semibold">Property settings</div>
        <div className="text-sm text-muted-foreground">Configuration shared across this property.</div>
      </div>

      <Card>
        <CardContent className="space-y-3">
          <div className="text-sm font-semibold">Date format</div>
          {!supportsDateFormat ? (
            <div className="text-sm text-muted-foreground">
              Date format preference isn’t available yet because the latest database migration
              hasn’t been applied.
            </div>
          ) : (
            <>
              <form action={updateDateFormat} className="flex flex-wrap items-end gap-3">
                <div className="flex flex-col">
                  <label className="text-sm">Display format</label>
                  <select
                    name="dateFormat"
                    className="rounded-md border border-border bg-background px-2 py-1 text-foreground"
                    defaultValue={current}
                  >
                    <option value="ISO">YYYY-MM-DD</option>
                    <option value="DMY">DD/MM/YYYY</option>
                    <option value="MDY">MM/DD/YYYY</option>
                  </select>
                </div>
                <Button variant="secondary" type="submit">
                  Save
                </Button>
              </form>

              <div className="text-sm text-muted-foreground">
                Controls how dates are displayed throughout the app. Date inputs remain ISO.
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
