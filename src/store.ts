import { Client } from "pg";
import { Chunk, Embedding } from "./types.js";

/** Row shape stored in the embedding table. */
interface EmbedRow {
  chunk_id: string;
  document_id: string;
  idx: number;
  text: string;
  embedding: string; // pgvector serializes arrays as e.g. [1,2,3]
  metadata?: unknown;
}

/**
 * Thin pgvector-backed vector store. Caller is responsible for creating the
 * schema (see init()) and for building an actual DB connection pool.
 */
export class VectorStore {
  constructor(private readonly client: Client) {}

  async init(): Promise<void> {
    await this.client.query('CREATE EXTENSION IF NOT EXISTS vector');
    await this.client.query(`
      CREATE TABLE IF NOT EXISTS retrieval_chunks (
        chunk_id     TEXT PRIMARY KEY,
        document_id  TEXT NOT NULL,
        idx          INT  NOT NULL,
        text         TEXT NOT NULL,
        embedding    vector(768) NOT NULL,
        metadata     JSONB,
        created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);
    await this.client.query(
      `CREATE INDEX IF NOT EXISTS retrieval_chunks_embedding_idx
       ON retrieval_chunks USING hnsw (embedding vector_cosine_ops)`,
    );
  }

  async upsert(chunks: Chunk[], embeddings: Embedding[]): Promise<void> {
    if (chunks.length !== embeddings.length) {
      throw new Error(
        `chunk/embedding count mismatch: ${chunks.length} chunks vs ${embeddings.length} embeddings`,
      );
    }
    const q = `
      INSERT INTO retrieval_chunks (chunk_id, document_id, idx, text, embedding, metadata)
      VALUES ($1, $2, $3, $4, $5::vector, $6::jsonb)
      ON CONFLICT (chunk_id) DO UPDATE SET
        text = EXCLUDED.text,
        embedding = EXCLUDED.embedding,
        metadata = EXCLUDED.metadata
    `;
    const values = chunks.map((c, i) => {
      const emb = embeddings[i];
      if (!emb) throw new Error("missing embedding for chunk " + c.id);
      return [
        c.id,
        c.documentId,
        c.index,
        c.text,
        `[${emb.join(",")}]`,
        JSON.stringify(c.metadata ?? null),
      ];
    });
    for (const v of values) {
      await this.client.query(q, v);
    }
  }

  /** All chunks, in store order (for batch/scan operations). */
  async allChunks(): Promise<Chunk[]> {
    const { rows } = await this.client.query<EmbedRow>(
      `SELECT chunk_id, document_id, idx, text, metadata
       FROM retrieval_chunks`,
    );
    return rows.map(toChunk);
  }

  async getByDocument(documentId: string): Promise<Chunk[]> {
    const { rows } = await this.client.query<EmbedRow>(
      `SELECT chunk_id, document_id, idx, text, metadata
       FROM retrieval_chunks WHERE document_id = $1 ORDER BY idx`,
      [documentId],
    );
    return rows.map(toChunk);
  }

  /** Cosine similarity search. Higher score = more relevant. */
  async similaritySearch(embedding: Embedding, topK: number): Promise<
    { chunk: Chunk; score: number }[]
  > {
    const { rows } = await this.client.query<EmbedRow>(
      `SELECT chunk_id, document_id, idx, text, metadata,
              1 - (embedding <=> $1::vector) AS score
       FROM retrieval_chunks
       ORDER BY embedding <=> $1::vector
       LIMIT $2`,
      [`[${embedding.join(",")}]`, topK],
    );
    return rows.map((r) => ({
      chunk: toChunk(r),
      score: (r as unknown as { score: number }).score,
    }));
  }

  async count(): Promise<number> {
    const { rows } = await this.client.query("SELECT count(*)::int AS n FROM retrieval_chunks");
    return rows[0]?.n ?? 0;
  }

  /** Distinct document ids currently indexed. */
  async listDistinctDocuments(): Promise<string[]> {
    const { rows } = await this.client.query<{ document_id: string }>(
      "SELECT DISTINCT document_id FROM retrieval_chunks ORDER BY document_id",
    );
    return rows.map((r) => r.document_id);
  }

  async clear(): Promise<void> {
    await this.client.query("DELETE FROM retrieval_chunks");
  }
}

function toChunk(r: EmbedRow): Chunk {
  return {
    id: r.chunk_id,
    documentId: r.document_id,
    index: r.idx,
    text: r.text,
    metadata: (r.metadata as Record<string, unknown> | undefined) ?? undefined,
  };
}