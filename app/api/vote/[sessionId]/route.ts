import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { votingSessions, candidates, votes, voteSelections } from "@/lib/schema";
import { eq, and } from "drizzle-orm";
import { voteEvents } from "@/lib/events";

// GET: fetch session info for voting page
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {

  const { sessionId } = await params;

  const [session] = await db
    .select()
    .from(votingSessions)
    .where(eq(votingSessions.id, sessionId));

  if (!session) {
    return NextResponse.json(
      { error: "투표를 찾을 수 없습니다." },
      { status: 404 }
    );
  }

  const sessionCandidates = await db
    .select()
    .from(candidates)
    .where(eq(candidates.sessionId, sessionId))
    .orderBy(candidates.sortOrder, candidates.number);

  // Check if voter already voted (via cookie)
  const voterToken = request.cookies.get(`voter_${sessionId}`)?.value;
  let alreadyVoted = false;
  if (voterToken) {
    const [existing] = await db
      .select()
      .from(votes)
      .where(
        and(eq(votes.sessionId, sessionId), eq(votes.voterToken, voterToken))
      );
    alreadyVoted = !!existing;
  }

  return NextResponse.json({
    session: {
      id: session.id,
      name: session.name,
      maxVotes: session.maxVotes,
      status: session.status,
    },
    candidates: sessionCandidates,
    alreadyVoted,
  });
}

// POST: submit vote
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {

  const { sessionId } = await params;
  const { candidateIds, voterToken } = await request.json();

  // Validate session
  const [session] = await db
    .select()
    .from(votingSessions)
    .where(eq(votingSessions.id, sessionId));

  if (!session) {
    return NextResponse.json(
      { error: "투표를 찾을 수 없습니다." },
      { status: 404 }
    );
  }

  if (session.status !== "open") {
    return NextResponse.json(
      { error: "현재 투표가 진행 중이 아닙니다." },
      { status: 400 }
    );
  }

  // Validate selection count
  if (
    !Array.isArray(candidateIds) ||
    candidateIds.length === 0 ||
    candidateIds.length > session.maxVotes
  ) {
    return NextResponse.json(
      { error: `1명 이상 ${session.maxVotes}명 이하로 선택해주세요.` },
      { status: 400 }
    );
  }

  // Check duplicate vote
  if (voterToken) {
    const [existing] = await db
      .select()
      .from(votes)
      .where(
        and(eq(votes.sessionId, sessionId), eq(votes.voterToken, voterToken))
      );

    if (existing) {
      return NextResponse.json(
        { error: "이미 투표하셨습니다." },
        { status: 409 }
      );
    }
  }

  try {
    // Insert vote
    const [vote] = await db
      .insert(votes)
      .values({
        sessionId,
        voterToken,
      })
      .returning();

    // Insert selections
    for (const candidateId of candidateIds) {
      await db.insert(voteSelections).values({
        voteId: vote.id,
        candidateId,
      });
    }

    // Emit event for real-time updates
    voteEvents.emit(sessionId, { type: "vote", voteId: vote.id });

    const response = NextResponse.json({ success: true, voteId: vote.id });

    // Set voter cookie to prevent duplicate voting
    response.cookies.set(`voter_${sessionId}`, voterToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 30, // 30 days
      path: "/",
    });

    return response;
  } catch (error: unknown) {
    if (
      error instanceof Error &&
      (error.message.includes("unique constraint") || error.message.includes("duplicate key"))
    ) {
      return NextResponse.json(
        { error: "이미 투표하셨습니다." },
        { status: 409 }
      );
    }
    throw error;
  }
}
