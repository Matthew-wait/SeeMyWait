import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Postgres/Supabase error code, checking `err.code` then `err.cause.code`. */
export function getErrorCode(err: unknown): string | undefined {
  if (!err || typeof err !== "object") return undefined;
  const { code, cause } = err as { code?: unknown; cause?: unknown };
  if (typeof code === "string") return code;
  if (cause && typeof cause === "object" && typeof (cause as { code?: unknown }).code === "string") {
    return (cause as { code: string }).code;
  }
  return undefined;
}

/** Human-readable message from a caught value, falling back when it has none. */
export function getErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof Error && err.message) return err.message;
  if (err && typeof err === "object" && typeof (err as { message?: unknown }).message === "string") {
    return (err as { message: string }).message;
  }
  return fallback;
}
