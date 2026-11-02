import { NextResponse } from "next/server";
import { getCaller } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { receiptPathSchema } from "@/types";

// Receipts are private: send the caller to a 60-second signed URL (Storage RLS re-checks manage_expenses)
export async function GET(_request: Request, { params }: RouteContext<"/api/receipts/[path]">) {
  const { path } = await params;
  const parsed = receiptPathSchema.safeParse(path);
  if (!parsed.success || !(await getCaller())) return new NextResponse("Not found", { status: 404 });

  const supabase = await createClient();
  const { data } = await supabase.storage.from("expense-receipts").createSignedUrl(path, 60);
  if (!data) return new NextResponse("Not found", { status: 404 });

  return NextResponse.redirect(data.signedUrl);
}
