import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole, ApiError } from "@/lib/api-auth";
import { questionSchema } from "@/lib/schemas";

export async function POST(req: Request, { params }: { params: Promise<{ examId: string }> }) {
  try {
    await requireRole("ADMIN");
    const { examId } = await params;
    const body = await req.json();
    const parsed = questionSchema.parse(body);

    const question = await prisma.question.create({
      data: { examId, ...parsed, answer: parsed.answer as never },
    });
    return NextResponse.json(question, { status: 201 });
  } catch (err) {
    if (err instanceof ApiError) return NextResponse.json({ error: err.message }, { status: err.status });
    if (err instanceof Error && err.name === "ZodError") {
      return NextResponse.json({ error: "Invalid input", details: err.message }, { status: 400 });
    }
    throw err;
  }
}
