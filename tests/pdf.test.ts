import { expect, it } from "vitest";
import { parsePdf } from "@/lib/pdf";
import { fixturePdf, sampleLine } from "./fixtures/pdf";

it("parses a valid PDF and extracts grounds for evidence", async () => {
  const bytes = fixturePdf();
  await expect(parsePdf(bytes, 10485760, false)).resolves.toBe("");
  await expect(parsePdf(bytes, 10485760, true)).resolves.toBe(sampleLine);
});

it("rejects an oversized file and a non-PDF", async () => {
  await expect(parsePdf(fixturePdf(), 10, false)).rejects.toMatchObject({ code: "invalid_pdf" });
  await expect(parsePdf(Buffer.from("not a PDF"), 10485760, false)).rejects.toMatchObject({ code: "invalid_pdf" });
});

it("rejects PDF header and EOF markers without document structure", async () => {
  await expect(parsePdf(Buffer.from("%PDF-1.7\nnot a real document\n%%EOF\n"), 10485760, false))
    .rejects.toMatchObject({ code: "invalid_pdf" });
});

it("stores an image-only or empty-text PDF for manual review", async () => {
  const bytes = fixturePdf("");
  await expect(parsePdf(bytes, 10485760, false)).resolves.toBe("");
  await expect(parsePdf(bytes, 10485760, true)).rejects.toMatchObject({ code: "no_readable_text" });
});
