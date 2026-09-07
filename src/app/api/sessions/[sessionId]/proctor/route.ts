import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole, ApiError } from "@/lib/api-auth";

const bodySchema = z.object({ proctorId: z.string().min(1) });

export async function PUT(req: Request, { params }: { params: Promise<{ sessionId: string }> }) {
  try {
    await requireRole("ADMIN");
    const { sessionId } = await params;
    const { proctorId } = bodySchema.parse(await req.json());

    const proctor = await prisma.user.findUnique({ where: { id: proctorId } });
    if (!proctor || proctor.role !== "PROCTOR") throw new ApiError(400, "Not a proctor account");

    const updated = await prisma.examSession.update({
      where: { id: sessionId },
      data: { proctorId },
    });
    return NextResponse.json(updated);
  } catch (err) {
    if (err instanceof ApiError) return NextResponse.json({ error: err.message }, { status: err.status });
    if (err instanceof Error && err.name === "ZodError") {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    }
    throw err;
  }
}
