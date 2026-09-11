import { readFile } from "node:fs/promises";
import { basename, extname } from "node:path";
import { Document } from "./types.js";

export class LoaderError extends Error {}

/**
 * Load a local file into a Document. Supports txt, md/markdown, html, and
 * pdf (PDF requires the optional pdf-parse dependency; text is best-effort).
 */
export async function loadFile(path: string): Promise<Document> {
  const ext = extname(path).toLowerCase();
  const buf = await readFile(path);
  const title = basename(path);

  let content: string;
  switch (ext) {
    case ".txt":
    case ".md":
    case ".markdown":
    case ".html":
    case ".htm":
      content = buf.toString("utf8");
      break;
    case ".pdf": {
      // pdf-parse is a hard dependency in package.json; keep it optional at runtime
      let pdfParse: (b: Buffer) => Promise<{ text: string }> | { text: string };
      try {
        const mod = await import("pdf-parse");
        pdfParse = mod.default as typeof pdfParse;
      } catch {
        throw new LoaderError(
          "PDF support requires `pdf-parse`. Run `npm i pdf-parse` and retry.",
        );
      }
      const parsed = await pdfParse(buf);
      content = parsed.text ?? "";
      break;
    }
    default:
      throw new LoaderError(`Unsupported file type: ${ext}`);
  }

  return { id: path, title, format: toFormat(ext), content };
}

function toFormat(ext: string): Document["format"] {
  if (ext === ".pdf") return "pdf";
  if (ext === ".md" || ext === ".markdown") return "markdown";
  if (ext === ".html" || ext === ".htm") return "html";
  return "txt";
}

/**
 * Load an in-memory buffer as a Document (used by the HTTP upload path).
 * Same format handling as loadFile, minus the file read.
 */
export async function loadBuffer(filename: string, data: Buffer): Promise<Document> {
  const ext = extname(filename).toLowerCase();
  const title = basename(filename);
  let content: string;
  switch (ext) {
    case ".txt":
    case ".md":
    case ".markdown":
    case ".html":
    case ".htm":
      content = data.toString("utf8");
      break;
    case ".pdf": {
      let pdfParse: (b: Buffer) => Promise<{ text: string }> | { text: string };
      try {
        const mod = await import("pdf-parse");
        pdfParse = mod.default as typeof pdfParse;
      } catch {
        throw new LoaderError(
          "PDF support requires `pdf-parse`. Run `npm i pdf-parse` and retry.",
        );
      }
      const parsed = await pdfParse(data);
      content = parsed.text ?? "";
      break;
    }
    default:
      throw new LoaderError(`Unsupported file type: ${ext}`);
  }
  return { id: filename, title, format: toFormat(ext), content };
}