import { describe, expect, it } from "vitest";
import { chunkText } from "../src/chunk.js";

const DOC =
  "The quick brown fox jumps over the lazy dog. " +
  "Pack my box with five dozen liquor jugs. " +
  "How vexingly quick daft zebras jump. ";

describe("chunkText", () => {
  it("returns one chunk for a short doc", () => {
    const chunks = chunkText("hello world", "a.md");
    expect(chunks.length).toBe(1);
    expect(chunks[0].id).toBe("a.md#0");
    expect(chunks[0].index).toBe(0);
  });

  it("splits long content into ordered, non-empty chunks", () => {
    const chunks = chunkText(DOC, "a.md", { size: 40, overlap: 5 });
    expect(chunks.length).toBeGreaterThan(1);
    chunks.forEach((c, i) => {
      expect(c.documentId).toBe("a.md");
      expect(c.index).toBe(i);
      expect(c.text.length).toBeGreaterThan(0);
    });
  });

  it("produces consecutive chunks with at-most-overlap sharing", () => {
    const size = 30;
    const overlap = 5;
    const chunks = chunkText(DOC, "a.md", { size, overlap });
    expect(chunks.length).toBeGreaterThan(1);
    for (let i = 1; i < chunks.length; i++) {
      const prev = chunks[i - 1];
      const cur = chunks[i];
      // no more than `overlap` characters are shared between neighbors, and
      // the cursor always moves strictly forward.
      expect((cur.location as any).charStart).toBeGreaterThanOrEqual(
        (prev.location as any).charEnd - overlap,
      );
      expect((cur.location as any).charStart).toBeGreaterThan(
        (prev.location as any).charStart,
      );
    }
  });

  it("handles empty and whitespace-only content", () => {
    expect(chunkText("", "a.md")).toEqual([]);
    expect(chunkText("   \n\t ", "a.md")).toEqual([]);
  });
});