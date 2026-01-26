import { redirect } from "next/navigation";
import { getServerSession } from "next-auth/next";

import { authOptions } from "@/lib/auth";
import { DemoRequestCard } from "@/app/_components/DemoRequestCard";

export const dynamic = "force-dynamic";

export default async function Home() {
  const session = await getServerSession(authOptions);
  if (session?.user) {
    redirect("/dashboard");
  }

  const signInHref = "/api/auth/signin";

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="max-w-6xl mx-auto px-4 py-10 md:py-16">
        <nav className="flex items-center justify-between">
          <div className="text-lg font-semibold text-slate-900">Unified Ops</div>
          <a
            href={signInHref}
            className="inline-flex items-center justify-center rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-900 hover:bg-slate-50"
          >
            Sign in
          </a>
        </nav>

        <section className="mt-12 grid grid-cols-1 lg:grid-cols-2 gap-10 items-start">
          <div className="space-y-6">
            <div className="text-sm font-medium text-blue-600">Unified Ops PMS &amp; POS</div>
            <h1 className="text-4xl md:text-5xl font-semibold tracking-tight text-slate-900">
              One platform to run your property operations.
            </h1>
            <p className="text-base md:text-lg text-slate-600 max-w-xl">
              Unified Ops combines PMS, POS and basic channel management for small hotels,
              guesthouses and resorts.
            </p>

            <ul className="list-disc pl-5 space-y-2 text-sm md:text-base text-slate-700">
              <li>Stay &amp; availability management</li>
              <li>Integrated folios and payments</li>
              <li>Multi-property ready from day one</li>
            </ul>
          </div>

          <DemoRequestCard signInHref={signInHref} />
        </section>
      </div>
    </main>
  );
}
