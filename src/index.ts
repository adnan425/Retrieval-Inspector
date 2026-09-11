// RetrievalInspector — public API surface.

export { Rag } from "./rag.js";
export { VectorStore } from "./store.js";
export { OllamaClient } from "./ollama.js";
export { chunkText } from "./chunk.js";
export { loadFile, LoaderError } from "./loaders.js";
export { retrieveStrategy } from "./retrieval.js";
export { assembleContext, defaultSystemPrompt } from "./context.js";
export { loadConfig } from "./config.js";

export type {
  Document,
  Chunk,
  ScoredResult,
  RetrievalStrategy,
  SourceCitation,
  RetrievalTrace,
  Embedding,
  ChunkingConfig,
  QueryOptions,
  RagResult,
} from "./types.js";
export {
  DEFAULT_CHUNKING,
  DEFAULT_TOP_K,
} from "./types.js";