import { timingSafeEqual } from "node:crypto";
import { serviceDb } from "@/lib/db";
import { jsonError } from "@/lib/http";
import { processCleanup, processScreening } from "@/lib/worker";
import type { Job } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 55;

export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;
  const received = Buffer.from(request.headers.get("authorization") || "");
  const expected = Buffer.from(`Bearer ${secret || ""}`);
  if (!secret || secret.length < 32 || received.length !== expected.length || !timingSafeEqual(received, expected)) {
    return jsonError("Unauthorized.", 401);
  }
  try {
    const db = serviceDb();
    if (new URL(request.url).searchParams.get("cleanup") === "1") {
      await processCleanup(db);
      return Response.json({ ok: true });
    }
    const { data, error } = await db.rpc("claim_screenings", { p_limit: 1 });
    if (error) throw new Error("queue_claim_failed");
    const jobs = (data || []) as Job[];
    for (const job of jobs) await processScreening(db, job);
    return Response.json({ handled: jobs.length });
  } catch {
    return jsonError("Worker temporarily unavailable. Unfinished jobs remain recoverable.", 503);
  }
}
