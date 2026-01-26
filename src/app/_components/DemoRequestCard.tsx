"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui/button";
import { submitDemoRequest, type DemoRequestState } from "@/app/demoActions";

const initialState: DemoRequestState = { ok: false };

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" variant="primary" disabled={pending}>
      {pending ? "Sending…" : "Request a demo"}
    </Button>
  );
}

export function DemoRequestCard({ signInHref }: { signInHref: string }) {
  const [state, action] = useActionState<DemoRequestState, FormData>(
    submitDemoRequest,
    initialState,
  );

  if (state.ok) {
    return (
      <div className="rounded-2xl bg-card shadow-sm border border-border p-6 md:p-8 space-y-4">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold text-foreground">Thank you!</h2>
          <p className="text-sm text-muted-foreground">
            We’ve received your request. Someone from Unified Ops will contact you shortly.
          </p>
        </div>

        <div className="text-sm">
          <Link href={signInHref} className="text-primary hover:underline">
            Already a customer? Sign in
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl bg-card shadow-sm border border-border p-6 md:p-8 space-y-4">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold text-foreground">Request a demo</h2>
        <p className="text-sm text-muted-foreground">
          Tell us a bit about your property and we’ll reach out to schedule a walkthrough.
        </p>
      </div>

      <form action={action} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-sm font-medium">First name</label>
            <input
              name="firstName"
              className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm text-foreground"
              required
              autoComplete="given-name"
            />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium">Last name</label>
            <input
              name="lastName"
              className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm text-foreground"
              required
              autoComplete="family-name"
            />
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium">Email</label>
          <input
            name="email"
            type="email"
            className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm text-foreground"
            required
            autoComplete="email"
          />
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium">Country</label>
          <input
            name="country"
            className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm text-foreground"
            placeholder="Optional"
            autoComplete="country-name"
          />
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium">Phone</label>
          <input
            name="phone"
            className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm text-foreground"
            placeholder="Optional"
            autoComplete="tel"
          />
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium">Job role</label>
          <input
            name="jobRole"
            className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm text-foreground"
            placeholder="Optional"
          />
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium">Property name</label>
          <input
            name="propertyName"
            className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm text-foreground"
            required
          />
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium">Property type</label>
          <select
            name="propertyType"
            className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm text-foreground"
            defaultValue=""
          >
            <option value="" disabled>
              Select one
            </option>
            <option value="Hotel">Hotel</option>
            <option value="Guesthouse">Guesthouse</option>
            <option value="Resort">Resort</option>
            <option value="Hostel">Hostel</option>
            <option value="Other">Other</option>
          </select>
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium">Number of rooms</label>
          <input
            name="roomsCount"
            type="number"
            min={1}
            className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm text-foreground"
            placeholder="Optional"
          />
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium">Message / notes</label>
          <textarea
            name="message"
            className="min-h-24 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground"
            placeholder="Optional"
          />
        </div>

        {state.error ? <div className="text-sm text-red-600">{state.error}</div> : null}

        <div className="flex justify-end">
          <SubmitButton />
        </div>
      </form>
    </div>
  );
}
