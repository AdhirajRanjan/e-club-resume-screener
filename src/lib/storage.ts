import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { resumeLimitBytes } from "./config";

export const resumeBucket = "resumes";

export class UploadError extends Error {
  constructor(public readonly reason: "missing" | "size" | "media" | "storage") {
    super(reason);
  }
}

export async function readResume(db: SupabaseClient, path: string) {
  const limit = resumeLimitBytes();
  const bucket = db.storage.from(resumeBucket);
  const { data, error } = await bucket.createSignedUrl(path, 30);
  if (error || !data) {
    const status = error && "statusCode" in error ? Number(error.statusCode) : 0;
    throw new UploadError(status === 404 || status === 400 ? "missing" : "storage");
  }
  const response = await fetch(data.signedUrl, { cache: "no-store", signal: AbortSignal.timeout(12000), redirect: "error" });
  if (!response.ok || !response.body) throw new UploadError(response.status === 404 ? "missing" : "storage");
  if (!(response.headers.get("content-type") || "").toLowerCase().startsWith("application/pdf")) {
    await response.body.cancel();
    throw new UploadError("media");
  }
  if (Number(response.headers.get("content-length")) > limit) {
    await response.body.cancel();
    throw new UploadError("size");
  }
  const reader = response.body.getReader();
  const parts: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > limit) {
        await reader.cancel();
        throw new UploadError("size");
      }
      parts.push(value);
    }
    return Buffer.concat(parts, size);
  } finally {
    reader.releaseLock();
  }
}
