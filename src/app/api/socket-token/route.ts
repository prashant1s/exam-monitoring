import jwt from "jsonwebtoken";
import { NextResponse } from "next/server";
import { requireUser, ApiError } from "@/lib/api-auth";

export async function GET() {
  try {
    const user = await requireUser();
    const secret = process.env.SOCKET_JWT_SECRET || process.env.AUTH_SECRET!;
    const token = jwt.sign({ sub: user.id, role: user.role, name: user.name }, secret, {
      expiresIn: "1h",
    });
    return NextResponse.json({ token });
  } catch (err) {
    if (err instanceof ApiError) return NextResponse.json({ error: err.message }, { status: err.status });
    throw err;
  }
}
