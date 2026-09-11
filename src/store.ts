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

/** Equality predicates against the JSONB metadata column. */
export type MetadataFilter = Record<string, string | number | boolean>;

/** Build a `WHERE ...` clause + positional params from a metadata filter. */
function buildWhere(
  filter?: MetadataFilter,
): { where: string; params: (string | number | boolean)[] } {
  if (!filter || Object.keys(filter).length === 0) {
    return { where: "", params: [] };
  }
  const params: (string | number | boolean)[] = [];
  const terms = Object.entries(filter).map(([key, value]) => {
    const i = params.length + 1;
    params.push(value);
    return `metadata ->> $${i} = $${i}`;
  });
  return { where: ` WHERE ${terms.join(" AND ")}`, params };
}

/**
 * Thin pgvector-backed vector store. Caller is responsible for creating the
 * schema (see init()) and for building an actual DB connection pool.
 */
export class VectorStore {
  constructor(private readonly client: Client) {}

  async init(): Promise<void> {
    await this.client.query("CREATE EXTENSION IF NOT EXISTS vector");
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
    for (let i = 0; i < chunks.length; i++) {
          const c = chunks[i];
          const emb = embeddings[i];
          if (!c || !emb) throw new Error("missing chunk or embedding for index " + i);
          await this.client.query(q, [
        c.id,
        c.documentId,
        c.index,
        c.text,
        `[${emb.join(",")}]`,
        JSON.stringify(c.metadata ?? null),
      ]);
    }
  }

  /** All chunks, optionally filtered by metadata, in store order. */
  async allChunks(filter?: MetadataFilter): Promise<Chunk[]> {
    const { where, params } = buildWhere(filter);
    const { rows } = await this.client.query<EmbedRow>(
      `SELECT chunk_id, document_id, idx, text, metadata
       FROM retrieval_chunks${where}`,
      params,
    );
    return rows.map(toChunk);
  }

  async getByDocument(
    documentId: string,
    filter?: MetadataFilter,
  ): Promise<Chunk[]> {
    const { where, params } = buildWhere(filter);
    const condition =
      where === "" ? "WHERE document_id = $1" : `${where} AND document_id = $${params.length + 1}`;
    const { rows } = await this.client.query<EmbedRow>(
      `SELECT chunk_id, document_id, idx, text, metadata
       FROM retrieval_chunks ${condition} ORDER BY idx`,
      [...params, documentId],
    );
    return rows.map(toChunk);
  }

  /** Cosine similarity search. Higher score = more relevant. */
  async similaritySearch(
    embedding: Embedding,
    topK: number,
    filter?: MetadataFilter,
  ): Promise<{ chunk: Chunk; score: number }[]> {
    const { where, params } = buildWhere(filter);
    const n = params.length;
    const { rows } = await this.client.query<EmbedRow>(
      `SELECT chunk_id, document_id, idx, text, metadata,
              1 - (embedding <=> $${n + 1}::vector) AS score
       FROM retrieval_chunks${where}
       ORDER BY embedding <=> $${n + 1}::vector
       LIMIT $${n + 2}`,
      [...params, `[${embedding.join(",")}]`, topK],
    );
    return rows.map((r) => ({
      chunk: toChunk(r),
      score: (r as unknown as { score: number }).score,
    }));
  }

  async count(): Promise<number> {
    const { rows } = await this.client.query(
      "SELECT count(*)::int AS n FROM retrieval_chunks",
    );
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