import type { PostgrestError } from "@supabase/supabase-js";

// Plain messages for common Postgres errors; RPC exception text is shown as is
export function toErrorMessage(error: PostgrestError): string {
  if (error.code === "23505" && error.message.includes("one_pending_request_per_product")) return "This item already has a pending request";
  if (error.code === "23505") return "This already exists";
  if (error.code === "42501") return "You do not have permission to do this";
  if (error.code === "P0001") return error.message;
  return "Something went wrong. Please try again.";
}
