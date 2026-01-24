import { requireActiveProperty } from "@/lib/propertyContext";
import { PageHeader } from "@/components/ui/PageHeader";

export default async function PosPage() {
  const { property } = await requireActiveProperty();

  return (
    <main className="mx-auto max-w-5xl p-6">
      <PageHeader title="POS" subtitle="Point of sale for in-house and external guests." />

      <p className="text-sm text-black/70">Property: {property.name}</p>
      <div className="mt-6 text-sm text-black/60">
        POS shifts, orders, and payments will go here.
      </div>
    </main>
  );
}
