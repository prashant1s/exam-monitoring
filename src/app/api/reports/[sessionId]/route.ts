import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser, authorizeExamSession, ApiError } from "@/lib/api-auth";

export async function GET(_req: Request, { params }: { params: Promise<{ sessionId: string }> }) {
  try {
    const user = await requireUser();
    const { sessionId } = await params;
    await authorizeExamSession(user, sessionId);

    const session = await prisma.examSession.findUnique({
      where: { id: sessionId },
      include: {
        candidate: { select: { id: true, name: true, email: true } },
        exam: { select: { id: true, title: true, durationMin: true } },
        events: { orderBy: { at: "asc" } },
        answers: true,
      },
    });
    if (!session) throw new ApiError(404, "Session not found");

    const bySeverity: Record<string, number> = {};
    for (const e of session.events) {
      bySeverity[e.severity] = (bySeverity[e.severity] ?? 0) + 1;
    }

    return NextResponse.json({
      session: {
        id: session.id,
        status: session.status,
        integrityScore: session.integrityScore,
        startedAt: session.startedAt,
        submittedAt: session.submittedAt,
        recordingUrl: session.recordingUrl,
      },
      candidate: session.candidate,
      exam: session.exam,
      events: session.events,
      summary: { totalEvents: session.events.length, bySeverity },
    });
  } catch (err) {
    if (err instanceof ApiError) return NextResponse.json({ error: err.message }, { status: err.status });
    throw err;
  }
}
