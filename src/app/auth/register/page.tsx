"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  initialRegisterOwnerState,
  registerOwner,
  type RegisterOwnerState,
} from "./actions";

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" variant="primary" disabled={pending}>
      {pending ? "Creating account…" : "Create account"}
    </Button>
  );
}

export default function RegisterPage() {
  const [state, action] = useActionState<RegisterOwnerState, FormData>(
    registerOwner,
    initialRegisterOwnerState,
  );

  return (
    <main className="min-h-screen flex items-center justify-center p-6 bg-background">
      <Card className="w-full max-w-md">
        <CardContent>
          <div className="space-y-1">
            <h1 className="text-xl font-semibold text-foreground">Create an account</h1>
            <p className="text-sm text-muted-foreground">
              Set up your first property and start using the PMS.
            </p>
          </div>

          <form action={action} className="mt-6 space-y-4">
            {state?.error ? (
              <div
                className="rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground"
                role="alert"
              >
                {state.error}
              </div>
            ) : null}

            <div className="space-y-1">
              <label className="text-sm font-medium">Full name</label>
              <input
                name="name"
                className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm text-foreground"
                placeholder="Your name"
                required
                autoComplete="name"
              />
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium">Email</label>
              <input
                name="email"
                type="email"
                className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm text-foreground"
                placeholder="you@example.com"
                required
                autoComplete="email"
              />
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium">Password</label>
              <input
                name="password"
                type="password"
                className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm text-foreground"
                placeholder="At least 8 characters"
                required
                autoComplete="new-password"
                minLength={8}
              />
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium">Property name</label>
              <input
                name="propertyName"
                className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm text-foreground"
                placeholder="My Hotel"
                required
                autoComplete="organization"
              />
            </div>

            <div className="flex items-center justify-end pt-2">
              <SubmitButton />
            </div>
          </form>

          <div className="mt-4 text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link href="/api/auth/signin" className="text-primary hover:underline">
              Sign in
            </Link>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
