import { NextResponse } from "next/server";

export async function GET() {
  const envKeys = Object.keys(process.env).filter(
    (k) =>
      k.includes("DATABASE") ||
      k.includes("POSTGRES") ||
      k.includes("SUPABASE") ||
      k.includes("ADMIN")
  );

  const masked: Record<string, string> = {};
  for (const key of envKeys) {
    const val = process.env[key] || "";
    // Show first 20 chars only for security
    masked[key] = val.length > 20 ? val.substring(0, 20) + "..." : val ? "(set)" : "(empty)";
  }

  return NextResponse.json({ envKeys: masked });
}
