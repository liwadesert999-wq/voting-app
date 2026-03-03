// Run with: npx tsx lib/migrate.ts
// Creates all tables in the PostgreSQL database (Supabase/Neon/etc)

import postgres from "postgres";
import "dotenv/config";

const dbUrl =
  process.env.DATABASE_URL ||
  process.env.POSTGRES_URL ||
  process.env.POSTGRES_URL_NON_POOLING ||
  process.env.SUPABASE_DB_URL;

if (!dbUrl) {
  throw new Error("DATABASE_URL 환경변수가 설정되지 않았습니다.");
}

const sql = postgres(dbUrl);

async function migrate() {
  console.log("Creating tables...");

  await sql`
    CREATE TABLE IF NOT EXISTS voting_sessions (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      max_votes INTEGER NOT NULL DEFAULT 1,
      status TEXT NOT NULL DEFAULT 'draft',
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS candidates (
      id SERIAL PRIMARY KEY,
      session_id TEXT NOT NULL REFERENCES voting_sessions(id) ON DELETE CASCADE,
      number INTEGER NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      sort_order INTEGER NOT NULL DEFAULT 0
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS votes (
      id SERIAL PRIMARY KEY,
      session_id TEXT NOT NULL REFERENCES voting_sessions(id) ON DELETE CASCADE,
      voter_token TEXT NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      UNIQUE(session_id, voter_token)
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS vote_selections (
      id SERIAL PRIMARY KEY,
      vote_id INTEGER NOT NULL REFERENCES votes(id) ON DELETE CASCADE,
      candidate_id INTEGER NOT NULL REFERENCES candidates(id) ON DELETE CASCADE
    )
  `;

  console.log("All tables created successfully!");
  await sql.end();
}

migrate().catch(console.error);
