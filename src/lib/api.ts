import { NextResponse } from "next/server";
import { ZodError } from "zod";

/** Uniform JSON error shape for every API route. */
export function apiError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

/** Wrap a handler so thrown errors become clean JSON instead of 500 pages. */
export function handler<T extends (...args: never[]) => Promise<NextResponse>>(
  fn: T
): (...args: Parameters<T>) => Promise<NextResponse> {
  return async (...args: Parameters<T>) => {
    try {
      return await fn(...args);
    } catch (err) {
      if (err instanceof ZodError) {
        return apiError(err.issues[0]?.message ?? "Invalid input.", 422);
      }
      const status = (err as { status?: number }).status ?? 500;
      if (status >= 500) console.error("[api]", err);
      return apiError((err as Error).message ?? "Something went wrong.", status);
    }
  };
}
