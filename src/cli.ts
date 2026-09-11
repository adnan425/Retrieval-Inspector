#!/usr/bin/env node
import { parseArgs } from "node:util";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { basename, extname, join } from "node:path";
import { config as loadDotenv } from "dotenv";
import { Rag } from "./rag.js";
import { loadConfig } from "./config.js";
import { RetrievalStrategy } from "./types.js";
import { uiHtml } from "./ui.js";

loadDotenv();

const LIB_DIR = join(import.meta.dirname, "..", "public", "lib");
const MIME: Record<string, string> = { ".js": "text/javascript", ".css": "text/css", ".map": "application/json" };

const usage = `RetrievalInspector — inspect, debug, and improve RAG retrieval.

USAGE
  ri ingest <file> [file...]     Load docs, chunk, embed, index.
  ri query "<question>" [<strategy>]   Ask a question and dump the retrieval trace.
  ri serve [port]                Run the HTTP API (POST /query, GET /health).
  ri status                       Show connected store + embeddings count.
  ri clear                        Delete all indexed chunks.
  ri help                         Show this help.

  strategy: vector | keyword | hybrid | reranked | all (default: all)

  Requires a running Postgres/pgvector + Ollama (see docker-compose.yml).
  Config via .env (see .env.example).
`;

async function main(): Promise<void> {
  const { positionals } = parseArgs({ allowPositionals: true, strict: false });
  const [cmd, ...rest] = positionals;
  let serveStarted = false;

  if (!cmd || cmd === "help" || cmd === "--help" || cmd === "-h") {
    console.log(usage);
    return;
  }

  const cfg = loadConfig();
  const rag = new Rag(cfg);
  await rag.connect();

  try {
    switch (cmd) {
      case "ingest": {
        if (rest.length === 0) throw new Error("ingest requires at least one file path");
        for (const f of rest) {
          const res = await rag.ingestFile(f);
          console.log(`indexed ${f}: ${res.chunks} chunks, ${res.embeddings} embeddings`);
        }
        break;
      }
      case "query": {
        const q = rest[0];
        if (!q) throw new Error("query requires a question in quotes");
        const strat = (rest[1] ?? "all").toLowerCase();
        const strategies: RetrievalStrategy[] =
          strat === "all"
            ? ["vector", "keyword", "hybrid", "reranked"]
            : [strat as RetrievalStrategy];

        const { answer, trace } = await rag.query(q, {
          topK: cfg.topK,
          strategies,
          rerankCandidatesMultiplier: 3,
        });

        console.log("\n" + "─".repeat(60));
        console.log(`ANSWER (${trace.sources.length} sources)`);
        console.log("─".repeat(60));
        console.log(answer);
        console.log("\n" + "═".repeat(60));
        console.log("RETRIEVAL TRACE");
        console.log("═".repeat(60));
        for (const s of strategies) {
          console.log(`\n[${s}] ${trace.resultsByStrategy[s]?.length ?? 0} hits`);
          for (const r of trace.resultsByStrategy[s] ?? []) {
            console.log(`  #${r.rank} score=${r.score.toFixed(4)} ${r.chunk.id}`);
            console.log(`     ${r.chunk.text.slice(0, 120).replace(/\s+/g, " ")}${r.chunk.text.length > 120 ? "…" : ""}`);
          }
        }
        console.log(`\n[context] ${trace.context.length} chars -> LLM`);
        console.log(`[pruned duplicates] ${trace.prunedDuplicates.length}`);
        break;
      }
      case "status": {
        const n = await rag.store.count();
        console.log(`store: ${cfg.databaseUrl.split("@")[1] ?? "?"}`);
        console.log(`indexed chunks: ${n}`);
        console.log(`embed model: ${cfg.ollama.embedModel} (${cfg.ollama.embedDimensions}d)`);
        console.log(`chat model: ${cfg.ollama.chatModel}`);
        break;
      }
      case "clear": {
        await rag.store.clear();
        console.log("store cleared.");
        break;
      }
      case "serve": {
        serve(rag, Number(rest[0]) || 8787); // serves forever; closes rag on exit
        serveStarted = true;
        break;
      }
      default:
        console.error(`unknown command: ${cmd}\n`);
        console.log(usage);
        process.exitCode = 1;
    }
  } finally {
    if (!serveStarted) await rag.close();
  }
}

/** Minimal HTTP API: GET /health, POST /query {query, topK, strategies}. */
function serve(rag: Rag, port: number): void {
  const server = createServer(async (req, res) => {
    const send = (code: number, body: unknown) => {
      res.writeHead(code, { "Content-Type": "application/json" });
      res.end(JSON.stringify(body));
    };
    const url = new URL(req.url ?? "/", "http://localhost");
    // Static library files (Chart.js, Mermaid)
    if (req.method === "GET" && url.pathname.startsWith("/lib/")) {
      try {
        const file = join(LIB_DIR, basename(url.pathname));
        const data = await readFile(file);
        res.writeHead(200, { "Content-Type": MIME[extname(file)] ?? "application/octet-stream" });
        res.end(data);
      } catch {
        send(404, { error: "lib not found" });
      }
      return;
    }
    // Browser UI at the root
    if (req.method === "GET" && (url.pathname === "/" || url.pathname === "/index.html")) {
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(uiHtml());
      return;
    }
    if (req.method === "GET" && url.pathname === "/health") {
      try {
        const n = await rag.store.count();
        send(200, { ok: true, indexedChunks: n });
      } catch (err) {
        send(500, { ok: false, error: err instanceof Error ? err.message : String(err) });
      }
      return;
    }
    if (req.method === "GET" && url.pathname === "/docs") {
      try {
        const names = await rag.listDocs();
        send(200, { docs: names });
      } catch (err) {
        send(500, { ok: false, error: err instanceof Error ? err.message : String(err) });
      }
      return;
    }
    if (req.method === "POST" && url.pathname === "/upload") {
      let raw = Buffer.alloc(0);
      for await (const chunk of req) raw = Buffer.concat([raw, chunk]);
      const name = basename(url.searchParams.get("name") || "upload.txt");
      try {
        const result = await rag.ingestBuffer(name, raw);
        send(200, result);
      } catch (err) {
        send(400, { error: err instanceof Error ? err.message : String(err) });
      }
      return;
    }
    if (req.method === "POST" && url.pathname === "/query") {
      let raw = "";
      for await (const chunk of req) raw += chunk;
      let body: { query?: string; topK?: number; strategies?: RetrievalStrategy[] };
      try {
        body = JSON.parse(raw);
      } catch {
        send(400, { error: "invalid JSON body" });
        return;
      }
      const q = body.query?.trim();
      if (!q) {
        send(400, { error: "missing 'query' string" });
        return;
      }
      const strategies: RetrievalStrategy[] =
        Array.isArray(body.strategies) && body.strategies.length
          ? body.strategies
          : ["vector", "keyword", "hybrid", "reranked"];
      try {
        const result = await rag.query(q, {
          topK: Math.max(1, body.topK ?? 5),
          strategies,
          rerankCandidatesMultiplier: 3,
        });
        send(200, result);
      } catch (err) {
        send(500, { error: err instanceof Error ? err.message : String(err) });
      }
      return;
    }
    send(404, { error: "not found" });
  });

  server.listen(port, () => {
    console.log(`RetrievalInspector API on http://localhost:${port}`);
    console.log(`  GET  /health     -> { ok, indexedChunks }`);
    console.log(`  POST /query      { query, topK?, strategies? } -> { answer, trace }`);
  });

  const shutdown = () => {
    server.close();
    rag.close().then(() => process.exit(0));
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((err) => {
  console.error(`error: ${err instanceof Error ? err.message : err}`);
  process.exit(1);
});