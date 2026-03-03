import { NextResponse } from "next/server";
import postgres from "postgres";

export async function GET() {
  const url =
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL ||
    process.env.POSTGRES_URL_NON_POOLING ||
    process.env.SUPABASE_DB_URL;

  if (!url) {
    return NextResponse.json({ error: "No DB URL found" });
  }

  // Mask the password in the URL for display
  const maskedUrl = url.replace(/:([^@]+)@/, ":***@");

  try {
    const sql = postgres(url, { prepare: false });
    const result = await sql`SELECT 1 as test`;
    await sql.end();
    return NextResponse.json({ status: "connected", maskedUrl, result });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ status: "error", maskedUrl, error: msg });
  }
}
