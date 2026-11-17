import { session } from "@/lib/auth";
import { resumeLimitBytes } from "@/lib/config";
import { serviceDb } from "@/lib/db";
import { databaseMessage, jsonError, sameOrigin } from "@/lib/http";
import { uploadSchema } from "@/lib/schema";
import { resumeBucket } from "@/lib/storage";

export async function POST(request: Request) {
  if (!sameOrigin(request)) return jsonError("Invalid request origin.", 403);
  const current = await session();
  if (!current || current.profile.role !== "applicant") return jsonError("Sign in as an applicant to upload a resume.", 403);
  const input = uploadSchema.safeParse(await request.json().catch(() => null));
  if (!input.success) return jsonError("Choose a PDF resume.", 400);
  if (input.data.size > resumeLimitBytes()) return jsonError("Your resume exceeds the file size limit.", 413);

  const db = serviceDb();
  const { data: path, error } = await db.rpc("begin_resume_upload", {
    p_user: current.profile.id, p_project: input.data.projectId,
  });
  if (error || typeof path !== "string") {
    return jsonError(databaseMessage(error?.message), error?.message === "upload_limit" ? 429 : 409);
  }
  const { data, error: signingError } = await db.storage.from(resumeBucket).createSignedUploadUrl(path, { upsert: false });
  if (signingError || !data) return jsonError("Private upload storage is temporarily unavailable.", 503);
  return Response.json({ path, token: data.token }, { headers: { "Cache-Control": "no-store" } });
}
