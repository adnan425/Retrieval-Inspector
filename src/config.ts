/** Loads runtime config from env vars with sane defaults for the docker stack. */

export interface RiConfig {
  databaseUrl: string;
  ollama: {
    baseUrl: string;
    embedModel: string;
    embedDimensions: number;
    chatModel: string;
  };
  chunk: { size: number; overlap: number };
  topK: number;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): RiConfig {
  return {
    databaseUrl:
      env.DATABASE_URL ??
      "postgres://ri:ri@localhost:5432/retrieval_inspector",
    ollama: {
      baseUrl: env.OLLAMA_BASE_URL ?? "http://localhost:11434",
      embedModel: env.OLLAMA_EMBED_MODEL ?? "nomic-embed-text",
      embedDimensions: Number(env.OLLAMA_EMBED_DIMENSIONS ?? 768),
      chatModel: env.OLLAMA_CHAT_MODEL ?? "qwen2.5:3b",
    },
    chunk: {
      size: Number(env.CHUNK_SIZE ?? 800),
      overlap: Number(env.CHUNK_OVERLAP ?? 100),
    },
    topK: Number(env.DEFAULT_TOP_K ?? 5),
  };
}