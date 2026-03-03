import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { candidates, votes, votingSessions } from "@/lib/schema";
import { eq, sql } from "drizzle-orm";
import { voteEvents } from "@/lib/events";

async function getResults(sessionId: string) {
  const [session] = await db
    .select()
    .from(votingSessions)
    .where(eq(votingSessions.id, sessionId));

  if (!session) return null;

  const candidateResults = await db
    .select({
      id: candidates.id,
      number: candidates.number,
      name: candidates.name,
      description: candidates.description,
      voteCount: sql<number>`(
        SELECT COUNT(*) FROM vote_selections vs
        JOIN votes v ON vs.vote_id = v.id
        WHERE vs.candidate_id = ${candidates.id}
        AND v.session_id = ${sessionId}
      )`,
    })
    .from(candidates)
    .where(eq(candidates.sessionId, sessionId))
    .orderBy(candidates.sortOrder, candidates.number);

  const [totalRow] = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(votes)
    .where(eq(votes.sessionId, sessionId));

  return {
    session,
    candidates: candidateResults,
    totalVotes: totalRow?.count ?? 0,
  };
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  // Check if SSE is requested
  const accept = request.headers.get("accept");
  if (accept?.includes("text/event-stream")) {
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        // Send initial data
        const initial = await getResults(id);
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify(initial)}\n\n`)
        );

        // Listen for vote events
        const unsubscribe = voteEvents.subscribe(id, async () => {
          try {
            const data = await getResults(id);
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify(data)}\n\n`)
            );
          } catch {
            // ignore errors during streaming
          }
        });

        // Clean up on close
        request.signal.addEventListener("abort", () => {
          unsubscribe();
          controller.close();
        });
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  }

  // Regular JSON response
  const results = await getResults(id);
  if (!results) {
    return Response.json({ error: "세션을 찾을 수 없습니다." }, { status: 404 });
  }
  return Response.json(results);
}
