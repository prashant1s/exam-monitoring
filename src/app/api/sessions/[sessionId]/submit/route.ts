import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser, authorizeExamSession, ApiError } from "@/lib/api-auth";
import { scoreSession, AUTO_FLAG_THRESHOLD } from "@/lib/integrity/scoring";
import { enqueueScoring } from "@/lib/queue";
import type { EventType } from "@/lib/events";

export async function POST(_req: Request, { params }: { params: Promise<{ sessionId: string }> }) {
  try {
    const user = await requireUser();
    const { sessionId } = await params;
    const examSession = await authorizeExamSession(user, sessionId);

    if (examSession.candidateId !== user.id) throw new ApiError(403, "Only the candidate can submit their session");
    if (examSession.status === "SUBMITTED" || examSession.status === "TERMINATED") {
      return NextResponse.json(examSession);
    }

    const events = await prisma.monitorEvent.findMany({
      where: { sessionId },
      select: { type: true },
    });
    const score = scoreSession(events as { type: EventType }[]);
    const status = score < AUTO_FLAG_THRESHOLD ? "FLAGGED" : "SUBMITTED";

    const updated = await prisma.examSession.update({
      where: { id: sessionId },
      data: { submittedAt: new Date(), status, integrityScore: score },
    });

    // Best-effort: re-run scoring as a background job once recordings/late events settle.
    void enqueueScoring(sessionId);

    return NextResponse.json(updated);
  } catch (err) {
    if (err instanceof ApiError) return NextResponse.json({ error: err.message }, { status: err.status });
    throw err;
  }
}
