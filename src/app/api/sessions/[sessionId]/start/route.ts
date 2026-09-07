import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser, authorizeExamSession, ApiError } from "@/lib/api-auth";

export async function POST(_req: Request, { params }: { params: Promise<{ sessionId: string }> }) {
  try {
    const user = await requireUser();
    const { sessionId } = await params;
    const examSession = await authorizeExamSession(user, sessionId);

    if (examSession.candidateId !== user.id) throw new ApiError(403, "Only the candidate can start their session");
    if (examSession.startedAt) return NextResponse.json(examSession);

    const updated = await prisma.examSession.update({
      where: { id: sessionId },
      data: { startedAt: new Date(), status: "IN_PROGRESS" },
    });
    return NextResponse.json(updated);
  } catch (err) {
    if (err instanceof ApiError) return NextResponse.json({ error: err.message }, { status: err.status });
    throw err;
  }
}
