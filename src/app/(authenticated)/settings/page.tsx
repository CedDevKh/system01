import { prisma } from "@/lib/prisma";
import { requireActiveProperty } from "@/lib/propertyContext";
import { normalizeDateFormat, type DateFormat } from "@/lib/dateFormat";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default async function SettingsPage() {
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
      <PageHeader title="Settings" subtitle={`Property: ${property.name}`} />

      <Card>
        <CardContent className="space-y-3">
          <div className="text-sm font-semibold">Date format</div>
          {!supportsDateFormat ? (
            <div className="text-sm text-black/70">
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
                    className="border px-2 py-1"
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

              <div className="text-sm text-black/60">
                Controls how dates are displayed throughout the app. Date inputs remain ISO.
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
