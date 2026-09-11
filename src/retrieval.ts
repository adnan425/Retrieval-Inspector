import { Chunk, Embedding, RetrievalStrategy, ScoredResult } from "./types.js";
import { VectorStore } from "./store.js";

export interface RetrievalConfig {
  /** Path-based regex or substring for tokenizing keyword search. */
  tokenize?: (text: string) => string[];
  /** Boost applied to keyword matches on title/common words. */
  keywordBoost?: number;
}

const WORD_RE = /\b[a-z0-9]+\b/gi;

/**
 * Run one strategy against a query embedding and/or raw text and return
 * scored, pre-ranked results. Chunk scores are normalized to 0..1 where a
 * higher number means more relevant.
 */
export async function retrieveStrategy(
  store: VectorStore,
  options: {
    strategy: RetrievalStrategy;
    embedding: Embedding;
    query: string;
    topK: number;
    rerankCandidatesMultiplier?: number;
    config?: RetrievalConfig;
  },
): Promise<ScoredResult[]> {
  const topK = options.topK;
  const multiplier = options.rerankCandidatesMultiplier ?? 3;
  const candidates = topK * multiplier;

  switch (options.strategy) {
    case "vector": {
      const hits = await store.similaritySearch(options.embedding, topK);
      return hits.map((h, i) => ({
        chunk: h.chunk,
        score: h.score,
        rank: i + 1,
        strategy: "vector",
      }));
    }
    case "keyword": {
      const tokens = (options.config?.tokenize ?? defaultTokenize)(options.query);
      const chunks = await store.allChunks();
      const scored = chunks
        .map((chunk) => {
          const text = chunk.text.toLowerCase();
          const hit = tokens.reduce(
            (acc, t) => acc + (text.includes(t.toLowerCase()) ? 1 : 0),
            0,
          );
          return { chunk, score: tokens.length ? hit / tokens.length : 0 };
        })
        .filter((s) => s.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, candidates);
      return scored.map((s, i) => ({
        chunk: s.chunk,
        score: s.score,
        rank: i + 1,
        strategy: "keyword",
      }));
    }
    case "hybrid": {
      const [vec, kw] = await Promise.all([
        retrieveStrategy(store, { ...options, strategy: "vector", topK: candidates }),
        retrieveStrategy(store, { ...options, strategy: "keyword", topK: candidates }),
      ]);
      // RRF-style merge then take topK
      const fused: Record<string, { chunk: Chunk; score: number }> = {};
      for (const [i, r] of vec.entries()) fuses(fused, r, i, 60);
      for (const [i, r] of kw.entries()) fuses(fused, r, i, 60);
      const merged = Object.values(fused).sort((a, b) => b.score - a.score).slice(0, topK);
      return merged.map((m, i) => ({
        chunk: m.chunk,
        score: m.score,
        rank: i + 1,
        strategy: "hybrid",
      }));
    }
    case "reranked": {
      // materialize vector candidates then rerank by cross-scoring against query terms
      const candidates2 = await retrieveStrategy(store, {
        ...options,
        strategy: "vector",
        topK: candidates,
      });
      const tokens = (options.config?.tokenize ?? defaultTokenize)(options.query);
      const reranked = candidates2
        .map((r) => {
          const text = r.chunk.text.toLowerCase();
          const termHits = tokens.reduce(
            (acc, t) => acc + (text.includes(t.toLowerCase()) ? 1 : 0),
            0,
          );
          // blend vector sim with lexical overlap
          const lexical = tokens.length ? termHits / tokens.length : 0;
          const boost = options.config?.keywordBoost ?? 0.25;
          return { chunk: r.chunk, score: r.score * (1 - boost) + lexical * boost };
        })
        .sort((a, b) => b.score - a.score)
        .slice(0, topK);
      return reranked.map((s, i) => ({
        chunk: s.chunk,
        score: s.score,
        rank: i + 1,
        strategy: "reranked",
      }));
    }
  }
}

function fuses(
  map: Record<string, { chunk: Chunk; score: number }>,
  r: ScoredResult,
  rank: number,
  k: number,
): void {
  const existing = map[r.chunk.id];
  const score = 1 / (k + rank + 1); // RRF reciprocal rank fusion
  map[r.chunk.id] = existing
    ? { chunk: r.chunk, score: existing.score + score }
    : { chunk: r.chunk, score };
}

function defaultTokenize(text: string): string[] {
  return text.toLowerCase().match(WORD_RE) ?? [];
}