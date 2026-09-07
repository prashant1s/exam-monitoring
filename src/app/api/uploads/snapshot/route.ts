import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser, authorizeExamSession, ApiError } from "@/lib/api-auth";
import { getUploadUrl, isStorageConfigured } from "@/lib/storage";

const bodySchema = z.object({
  sessionId: z.string().min(1),
  contentType: z.string().default("image/jpeg"),
});

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const { sessionId, contentType } = bodySchema.parse(await req.json());
    await authorizeExamSession(user, sessionId);

    if (!isStorageConfigured()) {
      throw new ApiError(503, "Object storage is not configured yet — set R2_* vars in .env");
    }

    const key = `sessions/${sessionId}/snapshots/${Date.now()}.jpg`;
    const { uploadUrl, publicUrl } = await getUploadUrl(key, contentType);

    return NextResponse.json({ uploadUrl, publicUrl, key });
  } catch (err) {
    if (err instanceof ApiError) return NextResponse.json({ error: err.message }, { status: err.status });
    if (err instanceof Error && err.name === "ZodError") {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    }
    throw err;
  }
}
