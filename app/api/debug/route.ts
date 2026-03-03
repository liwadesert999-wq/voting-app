import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { votingSessions } from "@/lib/schema";
import { desc, sql } from "drizzle-orm";

export async function GET() {
  try {
    const sessions = await db
      .select({
        id: votingSessions.id,
        name: votingSessions.name,
        maxVotes: votingSessions.maxVotes,
        status: votingSessions.status,
        createdAt: votingSessions.createdAt,
        candidateCount: sql<number>`(SELECT COUNT(*) FROM candidates WHERE candidates.session_id = voting_sessions.id)`,
        voteCount: sql<number>`(SELECT COUNT(*) FROM votes WHERE votes.session_id = voting_sessions.id)`,
      })
      .from(votingSessions)
      .orderBy(desc(votingSessions.createdAt));

    return NextResponse.json({ status: "ok", sessions });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ status: "error", error: msg });
  }
}
