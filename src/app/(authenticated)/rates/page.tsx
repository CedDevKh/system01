import { requireActiveProperty } from "@/lib/propertyContext";

export default async function RatesAndAvailabilityPage() {
  const { property } = await requireActiveProperty();

  return (
    <div className="mx-auto max-w-5xl p-6">
      <h1 className="text-2xl font-semibold mb-2">Rates & Availability</h1>
      <p className="text-sm text-black/70">Property: {property.name}</p>
      <div className="mt-6 text-sm text-black/60">
        Rate plans, rules, and availability controls will go here.
      </div>
    </div>
  );
}
