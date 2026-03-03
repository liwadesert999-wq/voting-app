import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { votingSessions, candidates } from "@/lib/schema";
import { isAdmin } from "@/lib/auth";
import { eq } from "drizzle-orm";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }


  const { id } = await params;
  const [session] = await db
    .select()
    .from(votingSessions)
    .where(eq(votingSessions.id, id));

  if (!session) {
    return NextResponse.json(
      { error: "세션을 찾을 수 없습니다." },
      { status: 404 }
    );
  }

  const sessionCandidates = await db
    .select()
    .from(candidates)
    .where(eq(candidates.sessionId, id))
    .orderBy(candidates.sortOrder, candidates.number);

  return NextResponse.json({ ...session, candidates: sessionCandidates });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }


  const { id } = await params;
  const body = await request.json();

  const updateData: Record<string, unknown> = {};
  if (body.name !== undefined) updateData.name = body.name;
  if (body.maxVotes !== undefined) updateData.maxVotes = body.maxVotes;
  if (body.status !== undefined) updateData.status = body.status;

  const [session] = await db
    .update(votingSessions)
    .set(updateData)
    .where(eq(votingSessions.id, id))
    .returning();

  if (!session) {
    return NextResponse.json(
      { error: "세션을 찾을 수 없습니다." },
      { status: 404 }
    );
  }

  return NextResponse.json(session);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }


  const { id } = await params;
  await db.delete(votingSessions).where(eq(votingSessions.id, id));

  return NextResponse.json({ success: true });
}
