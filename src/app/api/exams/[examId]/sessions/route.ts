import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole, ApiError } from "@/lib/api-auth";

export async function GET(_req: Request, { params }: { params: Promise<{ examId: string }> }) {
  try {
    await requireRole("PROCTOR", "ADMIN");
    const { examId } = await params;

    const sessions = await prisma.examSession.findMany({
      where: { examId },
      include: {
        candidate: { select: { id: true, name: true, email: true } },
        _count: { select: { events: true } },
        events: {
          orderBy: { at: "desc" },
          take: 20,
          select: { id: true, type: true, severity: true, at: true },
        },
      },
      orderBy: { startedAt: "asc" },
    });
    return NextResponse.json(sessions);
  } catch (err) {
    if (err instanceof ApiError) return NextResponse.json({ error: err.message }, { status: err.status });
    throw err;
  }
}
