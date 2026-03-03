import postgres from "postgres";
import { drizzle, PostgresJsDatabase } from "drizzle-orm/postgres-js";
import * as schema from "./schema";

let _db: PostgresJsDatabase<typeof schema> | null = null;

function getDatabaseUrl(): string {
  const url =
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL ||
    process.env.POSTGRES_URL_NON_POOLING ||
    process.env.SUPABASE_DB_URL;
  if (!url) {
    throw new Error("DATABASE_URL 환경변수가 설정되지 않았습니다.");
  }
  return url;
}

function getDb() {
  if (!_db) {
    const client = postgres(getDatabaseUrl(), { prepare: false });
    _db = drizzle(client, { schema });
  }
  return _db;
}

// Lazy proxy - avoids connecting at module load time (which fails during build)
export const db = new Proxy({} as PostgresJsDatabase<typeof schema>, {
  get(_, prop) {
    const realDb = getDb();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const value = (realDb as any)[prop];
    if (typeof value === "function") {
      return value.bind(realDb);
    }
    return value;
  },
});
