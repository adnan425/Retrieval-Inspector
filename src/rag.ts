import { Client } from "pg";
import { config as loadDotenv } from "dotenv";
import { RiConfig, loadConfig } from "./config.js";
import { chunkText } from "./chunk.js";
import { loadFile, loadBuffer } from "./loaders.js";
import { VectorStore } from "./store.js";
import { OllamaClient } from "./ollama.js";
import { retrieveStrategy } from "./retrieval.js";
import { assembleContext, defaultSystemPrompt } from "./context.js";
import {
  Chunk,
  Document,
  Embedding,
  QueryOptions,
  RagResult,
  RetrievalStrategy,
  ScoredResult,
} from "./types.js";

export interface RagOptions {
  /** Override the default system prompt for generation. */
  systemPrompt?: string;
}

const ALL_STRATEGIES: RetrievalStrategy[] = [
  "vector",
  "keyword",
  "hybrid",
  "reranked",
];

/**
 * RetrievalInspector entry point. Owns the DB connection, vector store and
 * Ollama client, and exposes the high-level `ingest()` / `query()` API.
 * Every query returns a RagResult whose `.trace` explains what was
 * retrieved, why, and what reached the model.
 */
export class Rag {
  readonly store: VectorStore;
  private readonly ollama: OllamaClient;
  private readonly client: Client;
  readonly cfg: RiConfig;

  constructor(cfg: RiConfig = loadConfig(), client?: Client) {
    this.cfg = cfg;
    this.client = client ?? new Client({ connectionString: cfg.databaseUrl });
    this.store = new VectorStore(this.client);
    this.ollama = new OllamaClient(cfg.ollama.baseUrl);
  }

  async connect(): Promise<void> {
    await this.client.connect();
    await this.store.init();
  }

  async close(): Promise<void> {
    await this.client.end().catch(() => undefined);
  }

  /** Load one file, chunk it, embed each chunk, and upsert to the store. */
  async ingestFile(path: string): Promise<{ chunks: number; embeddings: number }> {
    const doc = await loadFile(path);
    return this.ingestDoc(doc);
  }

  /** Ingest a document from raw bytes + a filename (used by the HTTP upload). */
  async ingestBuffer(filename: string, data: Buffer): Promise<{ chunks: number; embeddings: number }> {
    const doc = await loadBuffer(filename, data);
    return this.ingestDoc(doc);
  }

  /** Chunk + embed + upsert an already-loaded document. */
  private async ingestDoc(doc: Document): Promise<{ chunks: number; embeddings: number }> {
    const chunks = chunkText(doc.content, doc.id, this.cfg.chunk);
    const embeddings = await this.embed(chunks.map((c) => c.text));
    await this.store.upsert(chunks, embeddings);
    return { chunks: chunks.length, embeddings: embeddings.length };
  }

  /** Distinct document ids currently indexed. */
  async listDocs(): Promise<string[]> {
    return this.store.listDistinctDocuments();
  }

  /** Embed a batch of texts via Ollama. */
  async embed(texts: string[]): Promise<Embedding[]> {
    return this.ollama.embed(this.cfg.ollama.embedModel, texts);
  }

  /**
   * Run the full RAG pipeline. Returns the generated answer plus a full
   * RetrievalTrace explaining what was retrieved and why.
   */
  async query(query: string, options: QueryOptions): Promise<RagResult> {
    const strategies = options.strategies.length
      ? options.strategies
      : ALL_STRATEGIES;
    const topK = Math.max(1, options.topK);
    const embedding = (await this.embed([query]))[0];
    if (!embedding) throw new Error("Ollama returned no embedding for the query");

    // Run each strategy in parallel with its own candidate pool.
    const perStrategy = await Promise.all(
      strategies.map(async (s) => ({
        strategy: s,
        results: await retrieveStrategy(this.store, {
          strategy: s,
          embedding,
          query,
          topK,
          rerankCandidatesMultiplier: options.rerankCandidatesMultiplier,
        }),
      })),
    );

    const resultsByStrategy = Object.fromEntries(
      perStrategy.map((p) => [p.strategy, p.results]),
    ) as Record<RetrievalStrategy, ScoredResult[]>;

    // Final merged, deduped, top-K set across all strategies.
    const finalResults = mergeFinal(
      perStrategy.flatMap((p) => p.results),
      topK,
    );

    // Assemble the exact context handed to the LLM (pruning duplicates).
    const { context, pruned, sources } = assembleContext(finalResults, {
      maxContextChars: this.cfg.chunk.size * (topK + 1),
    });

    const answer = await this.ollama.generate(
      this.cfg.ollama.chatModel,
      `Context:\n${context}\n\nQuestion: ${query}`,
      defaultSystemPrompt(),
    );

    return {
      answer,
      trace: {
        query,
        resultsByStrategy,
        finalResults,
        context,
        prunedDuplicates: pruned,
        sources,
        timestamp: new Date().toISOString(),
      },
    };
  }
}

/** Merge per-strategy results into one deduped, score-sorted, top-K ranked list. */
function mergeFinal(all: ScoredResult[], topK: number): ScoredResult[] {
  const byId = new Map<string, ScoredResult>();
  for (const r of all) {
    const existing = byId.get(r.chunk.id);
    if (!existing || r.score > existing.score) byId.set(r.chunk.id, r);
  }
  return [...byId.values()].sort((a, b) => b.score - a.score).slice(0, topK);
}

/** Pick the best single answer when `mergeFinal` isn't desired (unused default). */
export type { Chunk };
export { loadDotenv };