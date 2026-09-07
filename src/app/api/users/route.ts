import { NextResponse } from "next/server";
import argon2 from "argon2";
import { prisma } from "@/lib/prisma";
import { requireRole, ApiError } from "@/lib/api-auth";
import { registerSchema } from "@/lib/schemas";

export async function GET() {
  try {
    await requireRole("ADMIN");
    const users = await prisma.user.findMany({
      select: { id: true, name: true, email: true, role: true, createdAt: true },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(users);
  } catch (err) {
    if (err instanceof ApiError) return NextResponse.json({ error: err.message }, { status: err.status });
    throw err;
  }
}

export async function POST(req: Request) {
  try {
    await requireRole("ADMIN");
    const parsed = registerSchema.parse(await req.json());

    const existing = await prisma.user.findUnique({ where: { email: parsed.email } });
    if (existing) throw new ApiError(409, "A user with that email already exists");

    const password = await argon2.hash(parsed.password);
    const user = await prisma.user.create({
      data: { name: parsed.name, email: parsed.email, role: parsed.role, password },
      select: { id: true, name: true, email: true, role: true, createdAt: true },
    });
    return NextResponse.json(user, { status: 201 });
  } catch (err) {
    if (err instanceof ApiError) return NextResponse.json({ error: err.message }, { status: err.status });
    if (err instanceof Error && err.name === "ZodError") {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    }
    throw err;
  }
}
