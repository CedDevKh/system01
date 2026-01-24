import { redirect } from "next/navigation";
import { getServerSession } from "next-auth/next";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

import { createProperty } from "@/app/actions/activeProperty";

export default async function SetupPropertyPage() {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;

  if (!userId) {
    redirect("/api/auth/signin");
  }

  const propertyCount = await prisma.propertyUser.count({
    where: {
      userId,
      property: { isActive: true },
    },
  });

  if (propertyCount > 0) {
    redirect("/dashboard");
  }

  return (
    <main className="mx-auto max-w-2xl p-6">
      <h1 className="text-2xl font-semibold">Create your first property</h1>
      <p className="mt-2 text-sm text-black/70">Set up the first property to start using the PMS.</p>

      <form action={createProperty} className="mt-6 space-y-4">
        <div className="space-y-1">
          <label className="text-sm font-medium">Name</label>
          <input
            name="name"
            className="w-full rounded-md border border-black/10 bg-white px-3 py-2"
            placeholder="Demo Property"
            required
          />
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium">Type</label>
          <select
            name="type"
            className="w-full rounded-md border border-black/10 bg-white px-3 py-2"
            defaultValue="HOTEL"
            required
          >
            <option value="HOTEL">Hotel</option>
            <option value="GUESTHOUSE">Guesthouse</option>
            <option value="RESORT">Resort</option>
            <option value="APARTMENT">Apartment</option>
          </select>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1">
            <label className="text-sm font-medium">Timezone</label>
            <input
              name="timezone"
              className="w-full rounded-md border border-black/10 bg-white px-3 py-2"
              defaultValue="Asia/Phnom_Penh"
              required
            />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium">Currency</label>
            <input
              name="currency"
              className="w-full rounded-md border border-black/10 bg-white px-3 py-2"
              defaultValue="USD"
              required
            />
          </div>
        </div>

        <button
          type="submit"
          className="rounded-md border border-black/10 bg-black px-4 py-2 text-sm font-medium text-white"
        >
          Create property
        </button>
      </form>
    </main>
  );
}

