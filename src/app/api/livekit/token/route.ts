import { NextResponse } from "next/server";
import { AccessToken } from "livekit-server-sdk";
import { requireUser, authorizeExamSession, ApiError } from "@/lib/api-auth";
import { z } from "zod";

const bodySchema = z.object({ sessionId: z.string().min(1) });

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const { sessionId } = bodySchema.parse(await req.json());
    const examSession = await authorizeExamSession(user, sessionId);

    const apiKey = process.env.LIVEKIT_API_KEY;
    const apiSecret = process.env.LIVEKIT_API_SECRET;
    const url = process.env.LIVEKIT_URL;
    if (!apiKey || !apiSecret || !url) {
      throw new ApiError(503, "LiveKit is not configured yet — set LIVEKIT_URL/API_KEY/API_SECRET in .env");
    }

    const isCandidate = user.role === "STUDENT";
    const at = new AccessToken(apiKey, apiSecret, { identity: user.id, name: user.name });
    at.addGrant({
      room: examSession.livekitRoom,
      roomJoin: true,
      canPublish: isCandidate,
      canSubscribe: !isCandidate,
    });

    return NextResponse.json({ token: await at.toJwt(), url });
  } catch (err) {
    if (err instanceof ApiError) return NextResponse.json({ error: err.message }, { status: err.status });
    if (err instanceof Error && err.name === "ZodError") {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    }
    throw err;
  }
}
