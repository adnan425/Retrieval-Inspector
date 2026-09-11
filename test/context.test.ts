import { describe, expect, it } from "vitest";
import { assembleContext } from "../src/context.js";
import type { ScoredResult } from "../src/types.js";

function hit(text: string, id = `doc#${Math.random()}`, score = 0.9): ScoredResult {
  return {
    chunk: { id, documentId: "doc.md", index: 0, text },
    score,
    rank: 1,
    strategy: "vector",
  } as ScoredResult;
}

describe("assembleContext", () => {
  it("produces a context string with numbered chunks", () => {
    const res = assembleContext([hit("alpha beta"), hit("gamma delta")]);
    expect(res.context).toContain("[1] alpha beta");
    expect(res.context).toContain("[2] gamma delta");
    expect(res.sources.length).toBe(2);
  });

  it("prunes exact duplicate chunks", () => {
    const res = assembleContext([hit("duplicate text here"), hit("duplicate text here")]);
    expect(res.context).toContain("duplicate text here");
    expect(res.sources.length).toBe(1);
    expect(res.pruned.length).toBe(1);
  });

  it("trims context to the character budget", () => {
    const long = "x".repeat(500);
    const res = assembleContext([hit(long), hit(long + " tail")], { maxContextChars: 600 });
    expect(res.context.length).toBeLessThanOrEqual(600);
  });

  it("handles empty input", () => {
    const res = assembleContext([]);
    expect(res.context).toBe("");
    expect(res.sources).toEqual([]);
    expect(res.pruned).toEqual([]);
  });
});