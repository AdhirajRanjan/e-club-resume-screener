import { session } from "@/lib/auth";
import { resumeLimitBytes } from "@/lib/config";
import { serviceDb } from "@/lib/db";
import { databaseMessage, jsonError, sameOrigin } from "@/lib/http";
import { parsePdf, PdfError } from "@/lib/pdf";
import { submissionSchema } from "@/lib/schema";
import { readResume, UploadError } from "@/lib/storage";

export const runtime = "nodejs";
export const maxDuration = 45;

export async function POST(request: Request) {
  if (!sameOrigin(request)) return jsonError("Invalid request origin.", 403);
  const current = await session();
  if (!current || current.profile.role !== "applicant") return jsonError("Sign in as an applicant to submit.", 403);
  const parsed = submissionSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError("Check your answers and enter valid HTTP or HTTPS links.", 400);
  const { path, projectId, answers, links, expectedVersion, questions } = parsed.data;
  const db = serviceDb();
  const { data: ticket, error: ticketError } = await db.from("upload_tickets").select("created_at,finalized_at")
    .eq("path", path).eq("user_id", current.profile.id).eq("project_id", projectId).maybeSingle();
  if (ticketError) return jsonError("We couldn’t verify your upload. Try again.", 503);
  if (!ticket || (!ticket.finalized_at && Date.parse(ticket.created_at) < Date.now() - 20 * 60000)) {
    return jsonError(databaseMessage("upload_expired"), 409);
  }
  if (!ticket.finalized_at) {
    try {
      const bytes = await readResume(db, path);
      await parsePdf(bytes, resumeLimitBytes(), false);
    } catch (error) {
      if (error instanceof UploadError && error.reason === "size") return jsonError("Your resume exceeds the file size limit.", 413);
      if (error instanceof PdfError && error.code === "unsupported_pdf") return jsonError("Upload a PDF with up to 20 pages.", 415);
      if ((error instanceof PdfError && error.code !== "pdf_timeout") ||
        (error instanceof UploadError && error.reason === "media")) {
        return jsonError("Upload a readable, unencrypted PDF document.", 415);
      }
      if (error instanceof UploadError && error.reason === "missing") return jsonError("Upload the PDF before submitting.", 409);
      return jsonError("We couldn’t verify the PDF right now. Try again.", 503);
    }
  }
  const { data: id, error } = await db.rpc("submit_resume", {
    p_user: current.profile.id, p_project: projectId, p_path: path, p_expected_version: expectedVersion,
    p_question_snapshot: questions, p_answers: answers, p_links: links,
  });
  if (error || !id) return jsonError(databaseMessage(error?.message), 409);
  return Response.json({ id }, { headers: { "Cache-Control": "no-store" } });
}
