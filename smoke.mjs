import { chunkText } from "./dist/chunk.js";
import { loadFile } from "./dist/loaders.js";
import { assembleContext } from "./dist/context.js";

let failures = 0;
function ok(name, cond) {
  console.log(`${cond ? "PASS" : "FAIL"}: ${name}`);
  if (!cond) failures++;
}

// chunker
const chunks = chunkText("The quick brown fox jumps over the lazy dog. ".repeat(6), "a.md", { size: 40, overlap: 5 });
ok("chunker produced multiple chunks", chunks.length > 1);
ok("chunks ordered", chunks.every((c, i) => c.index === i));
ok("chunk ids namespaced", chunks[0].id.startsWith("a.md#"));
ok("empty => []", chunkText("", "a.md").length === 0);

// loader
const doc = await loadFile("./examples/sample-docs/wazuh.md");
ok("loader loads md", doc.format === "markdown" && doc.content.includes("Wazuh"));

// context assembly
const res = assembleContext([
  { chunk: { id: "a#0", documentId: "a.md", index: 0, text: "duplicate text here" }, score: 0.9, rank: 1, strategy: "vector" },
  { chunk: { id: "a#1", documentId: "a.md", index: 1, text: "duplicate text here" }, score: 0.8, rank: 2, strategy: "vector" },
  { chunk: { id: "b#0", documentId: "b.md", index: 0, text: "unique chunk content" }, score: 0.7, rank: 3, strategy: "keyword" },
]);
ok("context prunes duplicate", res.pruned.length === 1 && res.sources.length === 2);
ok("context numbered", res.context.includes("[1]") && res.context.includes("[2]"));

console.log(failures === 0 ? "\nALL SMOKE CHECKS PASSED" : `\n${failures} FAILURES`);
process.exit(failures === 0 ? 0 : 1);