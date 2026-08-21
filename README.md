# RetrievalInspector

> Inspect, debug, and improve your RAG retrieval pipeline.

**RetrievalInspector** is an open-source developer toolkit for understanding what happens inside a Retrieval-Augmented Generation (RAG) pipeline.

Instead of treating RAG as a black box, RetrievalInspector lets developers inspect documents, chunks, retrieval results, similarity scores, ranking, context selection, and source citations in one place.

## Why RetrievalInspector?

A RAG application can return a wrong answer even when the LLM itself is working correctly.

The problem may be:

* Poor document parsing
* Incorrect chunking
* Weak embeddings
* Irrelevant retrieval results
* Incorrect ranking
* Too much or too little context
* Missing source metadata
* Poor query formulation

RetrievalInspector helps developers see **what the system actually retrieved and why**.

```text
User Query
    │
    ▼
┌───────────────┐
│ Query         │
│ Processing    │
└───────┬───────┘
        │
        ▼
┌───────────────┐
│ Retrieval     │
│               │
│ Vector Search │
│ Keyword Search│
│ Hybrid Search │
└───────┬───────┘
        │
        ▼
┌───────────────┐
│ Ranking /     │
│ Reranking     │
└───────┬───────┘
        │
        ▼
┌───────────────┐
│ Context       │
│ Selection     │
└───────┬───────┘
        │
        ▼
┌───────────────┐
│ LLM           │
│ Generation    │
└───────┬───────┘
        │
        ▼
   Answer + Sources
```

## Core Features

### Retrieval Inspection

Inspect exactly which chunks were returned for a query.

```text
Query
"What is the refund policy?"

Retrieved Context

1. refund-policy.pdf
   Page: 2
   Score: 0.91

2. terms.pdf
   Section: Refunds
   Score: 0.84

3. faq.md
   Section: Payments
   Score: 0.76
```

### Similarity & Ranking

Understand how documents and chunks are ranked.

Track:

* Similarity scores
* Retrieval rank
* Metadata
* Distance metrics
* Top-K results
* Reranking results

### Context Inspection

See the exact context that is passed to the language model.

This makes it easier to identify:

* Missing information
* Irrelevant chunks
* Duplicate context
* Context overload
* Incorrect document selection

### Source & Citation Tracking

Connect generated answers back to their source documents.

```text
Answer

Refunds are available within 30 days of purchase.

Sources

✓ refund-policy.pdf — Page 2
✓ terms.md — Section 4
```

### Retrieval Comparison

Compare different retrieval strategies against the same query.

```text
                    Top 5 Results

Vector Search       ████████████████  5
Keyword Search      ████████████     4
Hybrid Search       █████████████████ 5
Reranked Search     █████████████████ 5
```

This makes it easier to experiment with retrieval quality instead of guessing.

### Local-First

RetrievalInspector is designed to work with local AI infrastructure.

The initial stack focuses on:

* Ollama
* PostgreSQL
* pgvector
* Docker

No paid AI API is required for the core development workflow.

## Architecture

RetrievalInspector is designed as a modular pipeline:

```text
                RetrievalInspector

┌─────────────────────────────────────────┐
│               Documents                 │
│      PDF · Markdown · TXT · HTML        │
└───────────────────┬─────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────┐
│              Ingestion                  │
│       Parse · Clean · Metadata          │
└───────────────────┬─────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────┐
│              Chunking                   │
│       Size · Overlap · Metadata         │
└───────────────────┬─────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────┐
│             Embeddings                  │
│       Local / Configurable Models       │
└───────────────────┬─────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────┐
│             Vector Store                │
│          PostgreSQL + pgvector          │
└───────────────────┬─────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────┐
│              Retrieval                  │
│     Vector · Keyword · Hybrid Search    │
└───────────────────┬─────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────┐
│             Reranking                   │
│        Optional relevance scoring       │
└───────────────────┬─────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────┐
│          RetrievalInspector             │
│                                         │
│  Chunks · Scores · Ranking · Context    │
│  Metadata · Sources · Retrieval Trace   │
└───────────────────┬─────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────┐
│                LLM                      │
│              Ollama                    │
└─────────────────────────────────────────┘
```

## Example

A developer can inspect a RAG query like this:

```ts
const result = await rag.query(
  "What is the refund policy?"
)
```

RetrievalInspector exposes the retrieval trace:

```ts
{
  query: "What is the refund policy?",

  results: [
    {
      document: "refund-policy.pdf",
      page: 2,
      score: 0.91,
      rank: 1
    },
    {
      document: "terms.md",
      section: "Refunds",
      score: 0.84,
      rank: 2
    }
  ],

  context: "...",

  sources: [
    {
      document: "refund-policy.pdf",
      page: 2
    }
  ]
}
```

## Supported Sources

The initial version will support:

* PDF
* Markdown
* Plain text
* HTML

Additional document formats can be added through the ingestion layer.

## Retrieval Strategies

RetrievalInspector is designed to support multiple strategies:

### Vector

Semantic similarity using embeddings.

### Keyword

Traditional keyword-based retrieval.

### Hybrid

Combines semantic and keyword retrieval.

### Reranked

Retrieves candidates first, then applies a second-stage relevance model.

The goal is to make retrieval experiments measurable and transparent.

## Tech Stack

The initial implementation is focused on a lightweight, open-source stack:

| Layer         | Technology     |
| ------------- | -------------- |
| Language      | TypeScript     |
| Runtime       | Node.js        |
| Database      | PostgreSQL     |
| Vector Search | pgvector       |
| Local LLM     | Ollama         |
| Containers    | Docker         |
| Testing       | Vitest         |
| CI            | GitHub Actions |

The architecture is intentionally provider-agnostic so additional models and storage providers can be added later.

## Roadmap

### Phase 1 — Foundation

* [ ] Project architecture
* [ ] Document ingestion
* [ ] PDF / Markdown / TXT support
* [ ] Chunking pipeline
* [ ] Metadata management
* [ ] PostgreSQL + pgvector integration

### Phase 2 — Retrieval

* [ ] Vector retrieval
* [ ] Keyword retrieval
* [ ] Hybrid retrieval
* [ ] Top-K configuration
* [ ] Similarity scoring
* [ ] Metadata filtering

### Phase 3 — Inspection

* [ ] Retrieval trace
* [ ] Chunk inspection
* [ ] Score visualization
* [ ] Ranking inspection
* [ ] Context inspection
* [ ] Source tracking
* [ ] Citation mapping

### Phase 4 — Evaluation

* [ ] Retrieval comparison
* [ ] Query test sets
* [ ] Retrieval metrics
* [ ] Precision / recall analysis
* [ ] Context relevance
* [ ] Experiment history

### Phase 5 — Developer Experience

* [ ] Web interface
* [ ] CLI
* [ ] REST API
* [ ] Docker Compose setup
* [ ] Configuration system
* [ ] Plugin/provider architecture

## Design Principles

### 1. Make retrieval observable

Developers should be able to see what their RAG system retrieved.

### 2. Prefer evidence over assumptions

Every generated answer should be traceable back to its retrieved context.

### 3. Local-first development

Developers should be able to experiment without depending on paid APIs.

### 4. Provider agnostic

Models, embedding providers, and vector stores should remain replaceable.

### 5. Simple by default

A basic RAG pipeline should require minimal configuration.

### 6. Built for developers

The project should provide useful APIs, logs, traces, tests, and documentation rather than only a chatbot interface.

## Who Is It For?

RetrievalInspector is designed for:

* AI engineers
* Software engineers
* RAG developers
* ML engineers
* Developer tool builders
* Researchers experimenting with retrieval
* Teams building knowledge-based AI applications

## Project Status

> 🚧 **Early development**

RetrievalInspector is currently being developed as an open-source project.

The API and architecture may change before the first stable release.

## Contributing

Contributions are welcome.

You can contribute by:

* Reporting bugs
* Suggesting features
* Improving documentation
* Adding document loaders
* Adding retrieval strategies
* Improving evaluation methods
* Adding integrations
* Writing tests
* Reviewing pull requests

Before submitting a pull request, please read the contribution guidelines.

## Development

Clone the repository:

```bash
git clone https://github.com/YOUR_USERNAME/retrieval-inspector.git

cd retrieval-inspector
```

Install dependencies:

```bash
npm install
```

Start the development environment:

```bash
docker compose up -d
```

Run the project:

```bash
npm run dev
```

Run tests:

```bash
npm test
```

## License

RetrievalInspector will be released under the **MIT License**.

See `LICENSE` for details.

## Vision

RAG systems should not be black boxes.

Developers should be able to understand:

> **What was retrieved? Why was it retrieved? What context reached the model? And where did the final answer come from?**

RetrievalInspector aims to make that process visible, measurable, and easier to improve.

---

**RetrievalInspector**
*Inspect. Understand. Improve.*
