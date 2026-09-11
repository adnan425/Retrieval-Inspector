import { Embedding } from "./types.js";

/** Minimal Ollama HTTP client, hardcoded to its local REST API. */
export class OllamaClient {
  constructor(private readonly baseUrl: string = "http://localhost:11434") {}

  async embed(model: string, texts: string[]): Promise<Embedding[]> {
    const out: Embedding[] = [];
    for (const text of texts) {
      const res = await fetch(`${this.baseUrl}/api/embed`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model, input: text }),
      });
      if (!res.ok) throw new Error(`embed failed (${res.status}): ${await res.text()}`);
      const data = (await res.json()) as { embeddings?: number[][] };
      const flat = data.embeddings?.[0];
      if (!flat) throw new Error("Ollama returned no embedding");
      out.push(flat);
    }
    return out;
  }

  async generate(model: string, prompt: string, system?: string): Promise<string> {
    const res = await fetch(`${this.baseUrl}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model, prompt, system, stream: false }),
    });
    if (!res.ok) throw new Error(`generate failed (${res.status}): ${await res.text()}`);
    const data = (await res.json()) as { response?: string };
    return data.response ?? "";
  }
}