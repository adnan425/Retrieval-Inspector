import { describe, expect, it } from "vitest";
import { loadBuffer } from "../src/loaders.js";

describe("loadBuffer metadata population", () => {
  it("populates source metadata on a txt buffer", async () => {
    const doc = await loadBuffer("notes.txt", Buffer.from("hello world"));
    expect(doc.format).toBe("txt");
    expect(doc.metadata).toBeDefined();
    expect(doc.metadata!.filename).toBe("notes.txt");
    expect(doc.metadata!.source).toBe("notes.txt");
    expect(doc.metadata!.byteSize).toBe(11);
  });

  it("sets format from the extension", async () => {
    const md = await loadBuffer("doc.md", Buffer.from("# title"));
    expect(md.format).toBe("markdown");
    const html = await loadBuffer("page.htm", Buffer.from("<html></html>"));
    expect(html.format).toBe("html");
    const txt = await loadBuffer("plain.TXT", Buffer.from("x"));
    expect(txt.format).toBe("txt");
  });

  it("throws on an unsupported extension", async () => {
    try {
      await loadBuffer("archive.zip", Buffer.from("x"));
      expect(true).toBe(false); // unreachable if it throws
    } catch (e) {
      expect(String(e)).toMatch(/Unsupported file type/);
    }
  });
});