import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser, authorizeExamSession, ApiError } from "@/lib/api-auth";

export async function GET(_req: Request, { params }: { params: Promise<{ sessionId: string }> }) {
  try {
    const user = await requireUser();
    const { sessionId } = await params;
    await authorizeExamSession(user, sessionId);

    const events = await prisma.monitorEvent.findMany({
      where: { sessionId },
      orderBy: { at: "asc" },
    });
    return NextResponse.json(events);
  } catch (err) {
    if (err instanceof ApiError) return NextResponse.json({ error: err.message }, { status: err.status });
    throw err;
  }
}
