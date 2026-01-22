import { NextResponse } from "next/server";

export function asRouteErrorResponse(err: unknown) {
  const status = typeof (err as any)?.status === "number" ? (err as any).status : 500;
  const message = err instanceof Error ? err.message : "Unknown error";

  return NextResponse.json(
    {
      error: message,
    },
    { status },
  );
}
