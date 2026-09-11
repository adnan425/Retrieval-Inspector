import { Chunk, ChunkingConfig, DEFAULT_CHUNKING } from "./types.js";

/**
 * Split a document into overlapping chunks with a fixed target size.
 * Tries to break on paragraph / sentence / whitespace boundaries so the
 * chunks stay readable, then falls back to hard character splits.
 *
 * Guarantees forward progress: each iteration advances the cursor at least
 * one character, so overlap larger than a produced chunk can never loop.
 */
export function chunkText(
  content: string,
  documentId: string,
  cfg: ChunkingConfig = DEFAULT_CHUNKING,
): Chunk[] {
  const size = Math.max(1, cfg.size);
  const overlap = Math.max(0, Math.min(cfg.overlap, size - 1));
  const chunks: Chunk[] = [];
  const plain = content.replace(/\r\n/g, "\n");

  let idx = 0;
  let cursor = 0;
  while (cursor < plain.length) {
    const floor = Math.min(cursor + Math.floor(size * 0.6), plain.length);
    let end = Math.min(cursor + size, plain.length);
    if (end < plain.length) {
      const windowStr = plain.slice(floor, end);
      // prefer paragraph break, then sentence, then whitespace
      let best = -1;
      const nl = windowStr.lastIndexOf("\n\n");
      if (nl >= 0) best = nl;
      else {
        const dot = windowStr.lastIndexOf(". ");
        const sp = windowStr.lastIndexOf(" ");
        best = dot >= sp ? dot : sp;
      }
      if (best >= 0) {
        end = Math.min(plain.length, floor + best + 1);
      }
    }
    // never emit empty chunks; guarantee the cursor moves forward
    const text = plain.slice(cursor, end).trim();
    if (text.length > 0) {
      chunks.push({
        id: `${documentId}#${idx}`,
        documentId,
        index: idx,
        text,
        location: { charStart: cursor, charEnd: end },
      });
      idx++;
    }

    const next = end - overlap;
    // hard guarantee: advance at least 1 char past the previous cursor
    cursor = next > cursor ? next : cursor + 1;

    if (end >= plain.length) break; // consumed the whole remainder: no overlap to apply
  }

  return chunks;
}