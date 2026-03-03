import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { votingSessions } from "@/lib/schema";
import { isAdmin } from "@/lib/auth";
import { v4 as uuidv4 } from "uuid";
import { desc, sql } from "drizzle-orm";

export async function GET() {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

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

    return NextResponse.json(sessions);
  } catch (e) {
    console.error("DB error in GET /api/admin/sessions:", e);
    return NextResponse.json(
      { error: "데이터베이스 연결 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { name, maxVotes } = await request.json();

  if (!name?.trim()) {
    return NextResponse.json(
      { error: "세션 이름을 입력해주세요." },
      { status: 400 }
    );
  }


  const id = uuidv4();
  const [session] = await db
    .insert(votingSessions)
    .values({
      id,
      name: name.trim(),
      maxVotes: maxVotes || 1,
    })
    .returning();

  return NextResponse.json(session, { status: 201 });
}
