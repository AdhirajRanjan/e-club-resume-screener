import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { join } from "node:path";
import { Worker } from "node:worker_threads";

export class PdfError extends Error {
  constructor(public readonly code: "invalid_pdf" | "unsupported_pdf" | "no_readable_text" | "pdf_timeout") {
    super(code);
  }
}

const pdfWorker = String.raw`
const { parentPort, workerData } = require("node:worker_threads");
console.warn = () => {};
console.log = () => {};

// PDF.js runs in a bounded worker and never renders or executes document actions.
(async () => {
  const { getDocument, VerbosityLevel } = await import(workerData.moduleUrl);
  const loading = getDocument({
    data: workerData.bytes, verbosity: VerbosityLevel.ERRORS,
    disableFontFace: true, useSystemFonts: false, useWasm: false,
    isEvalSupported: false, stopAtErrors: true, enableXfa: false,
  });
  try {
    const pdf = await loading.promise;
    if (!pdf.numPages || pdf.numPages > 20) return { error: "unsupported_pdf" };
    const first = await pdf.getPage(1);
    if (!workerData.extract) return { text: "" };
    const pages = [];
    let length = 0;
    for (let index = 1; index <= pdf.numPages; index++) {
      const page = index === 1 ? first : await pdf.getPage(index);
      const { items } = await page.getTextContent();
      const text = items.map((item) => "str" in item ? item.str + (item.hasEOL ? "\n" : " ") : "").join("").trim();
      const letters = text.match(/\p{L}/gu)?.length ?? 0;
      if (letters < 30 || (text.match(/\uFFFD/g)?.length ?? 0) > letters / 12) {
        return { error: "no_readable_text" };
      }
      length += text.length;
      if (length > 45000) return { error: "unsupported_pdf" };
      pages.push(text);
      page.cleanup();
    }
    return { text: pages.join("\n\n") };
  } catch (error) {
    return { error: error?.name === "PasswordException" || !workerData.extract ? "invalid_pdf" : "no_readable_text" };
  } finally {
    await loading.destroy();
  }
})().then((result) => parentPort.postMessage(result)).catch(() => parentPort.postMessage({ error: "pdf_timeout" }));
`;

export async function parsePdf(bytes: Uint8Array, limit: number, extract: boolean): Promise<string> {
  const header = Buffer.from(bytes.subarray(0, 8)).toString("ascii");
  const tail = Buffer.from(bytes.subarray(-2048)).toString("latin1");
  if (bytes.length < 20 || bytes.length > limit || !/^%PDF-[12]\.\d$/.test(header) ||
    !/%%EOF[\x00\t\n\r\f ]*$/.test(tail)) {
    throw new PdfError("invalid_pdf");
  }

  const fromRoot = createRequire(join(process.cwd(), "package.json"));
  const moduleUrl = pathToFileURL(fromRoot.resolve("pdfjs-dist/legacy/build/pdf.mjs")).href;
  return new Promise((resolve, reject) => {
    const worker = new Worker(pdfWorker, {
      eval: true,
      workerData: { bytes, moduleUrl, extract },
      resourceLimits: { maxOldGenerationSizeMb: 128, maxYoungGenerationSizeMb: 32 },
      stdout: true,
      stderr: true,
    });
    worker.stdout.resume();
    worker.stderr.resume();
    const timer = setTimeout(() => {
      void worker.terminate();
      reject(new PdfError("pdf_timeout"));
    }, 9000);
    worker.once("message", (result: { text?: string; error?: PdfError["code"] }) => {
      clearTimeout(timer);
      void worker.terminate();
      if (result.error) reject(new PdfError(result.error));
      else resolve(result.text ?? "");
    });
    worker.once("error", () => {
      clearTimeout(timer);
      reject(new PdfError("pdf_timeout"));
    });
    worker.once("exit", () => {
      clearTimeout(timer);
      reject(new PdfError("pdf_timeout"));
    });
  });
}
