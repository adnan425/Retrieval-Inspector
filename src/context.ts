import { Chunk, ScoredResult, SourceCitation } from "./types.js";

export interface ContextAssemblyResult {
  /** The deduplicated context string handed to the LLM. */
  context: string;
  /** Chunks that were pruned as near-duplicates/overlaps. */
  pruned: ScoredResult[];
  /** The top loaded source citations. */
  sources: SourceCitation[];
}

/** Normalize text by lowercasing + collapsing whitespace for dup detection. */
function norm(s: string): string {
  return s.toLowerCase().replace(/\s+/g, " ").trim();
}

/**
 * Assemble the LLM context from the final ranked results, pruning
 * near-duplicate chunks (high textual overlap) so the model isn't fed
 * repeated content. Returns a JSON-serialisable assembly record.
 */
export function assembleContext(
  results: ScoredResult[],
  opts: { maxContextChars?: number } = {},
): ContextAssemblyResult {
  const maxChars = opts.maxContextChars ?? 8000;
  const selected: ScoredResult[] = [];
  const pruned: ScoredResult[] = [];
  const seen = new Set<string>();

  for (const r of results) {
    const key = norm(r.chunk.text);
    if (seen.has(key)) {
      pruned.push(r);
      continue;
    }
    // near-duplicate detection against already selected chunks
    let dup = false;
    for (const s of selected) {
      const a = norm(s.chunk.text);
      const b = norm(r.chunk.text);
      if (a && b && (a.includes(b) || b.includes(a))) {
        const shorter = Math.min(a.length, b.length);
        if (shorter > 0 && (a.includes(b) || b.includes(a)) && shorter >= 40) {
          dup = true;
          break;
        }
      }
    }
    if (dup) {
      pruned.push(r);
      continue;
    }
    if (selected.reduce((n, s) => n + s.chunk.text.length, 0) + r.chunk.text.length > maxChars) {
      // stop once we're over budget; don't drop a single oversized chunk
      if (selected.length === 0) {
        selected.push(r);
      }
      break;
    }
    selected.push(r);
    seen.add(key);
  }

  const context = selected
    .map((s, i) => `[${i + 1}] ${s.chunk.text}`)
    .join("\n\n---\n\n");

  const sources: SourceCitation[] = selected.map((s) => ({
    documentId: s.chunk.documentId,
    documentTitle: s.chunk.documentId.split(/[\\/]/).pop() ?? s.chunk.documentId,
    chunkId: s.chunk.id,
    location: s.chunk.location,
    score: s.score,
  }));

  return { context, pruned, sources };
}

/** Default RAG system prompt. */
export function defaultSystemPrompt(): string {
  return [
    "You are a precise retrieval assistant. Answer the user's question ",
    "using ONLY the provided context, in your own words. If the context ",
    "does not contain the answer, say you don't know rather than inventing.",
  ].join("");
}