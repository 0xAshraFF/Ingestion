# Submission Notes (for the reviewer)

Short, honest answers to the three questions a reviewer is likely to ask. File and line references point at the exact code that supports each claim.

---

## Q1. If I share my env key, is it safe? Where is it stored?

**Short answer:** It's filesystem-safe on the machine running the app, not "encrypted secret store" safe. The key never reaches the browser.

### Where keys live

There are two places a BYOK key can be stored:

1. **`.env` file** in the repo root. Loaded by Node from `process.env`. `.env` is in `.gitignore` and is the recommended place — see [docs/GUARDRAILS.md:6-12](../docs/GUARDRAILS.md#L6-L12).
2. **`data/store.json`** — when you paste a key into the *BYOK Vision Fallback* form in the UI, it is sent over `PATCH /api/settings/providers`, sanitized by [src/server.js:57-67](../src/server.js#L57-L67), and persisted by [src/lib/store.js:45-56](../src/lib/store.js#L45-L56). `data/` is in `.gitignore`.

### What the browser sees

The browser only ever receives a redacted state for each provider — `missing`, `set`, or `invalid-looking` — via [src/lib/providers.js:54-58](../src/lib/providers.js#L54-L58). The raw key never ships back. You can verify by opening DevTools → Network → `GET /api/settings/providers`.

### What this is NOT

- Not an encrypted secret store. Anyone with shell access to the box can `cat data/store.json` or `cat .env` and read the key in cleartext.
- Not zero-trust against a hostile host. For production deployment, swap `data/store.json` for a managed secret store (AWS Secrets Manager, GCP Secret Manager, HashiCorp Vault) and inject keys via env at process start.

### Concrete safety checklist for sharing

If you're handing a key to someone else's instance of this app:

- Confirm `.gitignore` excludes `data/` and `.env`.
- Use a **scoped, low-rate-limit key** — e.g. Anthropic console "restricted" keys with a per-month spend cap.
- Rotate the key after the demo.

---

## Q2. Have you built a RAG? Or trained a model?

**Short answer:** No model is trained. It's a **retrieval-grounded drafting pipeline**, not a classical vector RAG — and I'm explicit about which parts are real.

### What's actually grounded

Every draft cites real source text. The pipeline:

1. **OCR / text extraction** per page — Tesseract for images ([src/lib/localOcr.js](../src/lib/localOcr.js)), built-in text for `.txt` / `.md` / `.pdf`, plus a curated-transcript fallback for known handwritten samples ([src/lib/sampleTranscripts.js](../src/lib/sampleTranscripts.js)).
2. **Chunking** by paragraph, with page + file + confidence metadata preserved on every chunk ([src/lib/retrieval.js:3-19](../src/lib/retrieval.js#L3-L19)).
3. **Retrieval** scores each chunk against the draft-type query.
4. **Drafting** ([src/lib/drafts.js](../src/lib/drafts.js)) emits text that references retrieved chunks. Each citation carries `{ source, page, quoteOrSpan, confidence }` ([src/lib/retrieval.js:31-38](../src/lib/retrieval.js#L31-L38)).
5. **Unsupported claims** are surfaced explicitly when retrieval is empty or quality is amber/red ([src/lib/drafts.js:25-31](../src/lib/drafts.js#L25-L31)).

That grounding loop — chunk → retrieve → cite → flag unsupported — is the property that prevents hallucination, and **it works today**.

### What this is NOT

- **Not classical vector RAG.** The retriever in [src/lib/retrieval.js:40-50](../src/lib/retrieval.js#L40-L50) uses **token-overlap scoring with a quality-band boost**, not embeddings. No vector index, no embedding model loaded. The spec ([SPEC_Agent_Ready.md:177-179](../SPEC_Agent_Ready.md#L177-L179)) calls for local embeddings; that's a deliberate, known gap and is the first item in the scaling plan below.
- **No model is fine-tuned.** Tesseract ships with a pretrained CRNN; we use it as-is. The BYOK paths to Gemini and Claude call hosted inference APIs only — no fine-tuning happens locally.
- **No on-device LLM.** Drafts today are deterministic templates rendered from retrieved chunks (see `renderDraft` and `renderStudyNoteDraft` in [src/lib/drafts.js:49-145](../src/lib/drafts.js#L49-L145)). When a BYOK key is configured, a paid vision model can be called per page for OCR fallback — the boundary is in [src/lib/providers.js](../src/lib/providers.js).

I'd rather be honest about the retrieval shortcut than dress term-matching up as semantic search.

---

## Q3. How would you scale this into an automated pipeline?

The MVP is intentionally a single-process Node server with a JSON file store. Here's the migration path to a production pipeline, ordered by what unlocks the most value first.

### Step 1 — Decouple ingestion from request/response

Today `POST /api/documents/upload` ([src/server.js:81-99](../src/server.js#L81-L99)) does OCR, chunking, and result construction synchronously. At scale:

- Frontend uploads to **object storage** (S3 / GCS / R2) directly via signed URL.
- API enqueues a job (Redis + BullMQ, or SQS) and returns a `jobId`.
- A worker pool consumes jobs and writes per-stage outputs back to storage.
- UI subscribes via SSE/WebSocket for stage transitions (`uploaded → ocred → chunked → drafted`).

### Step 2 — Replace the JSON store with Postgres

[src/lib/store.js](../src/lib/store.js) writes everything to `data/store.json`. Migrate to:

- `documents`, `pages`, `chunks`, `drafts`, `edits`, `lessons` tables.
- Per-tenant rows with row-level security.
- BYOK keys go to a managed secret store, **not** Postgres.

### Step 3 — Real retrieval

Replace [src/lib/retrieval.js](../src/lib/retrieval.js)'s term-overlap with:

- Embedding model: `text-embedding-3-small` (hosted) or a local `sentence-transformers` model deployed alongside workers.
- Vector index: **pgvector** (keeps everything in Postgres) or **Qdrant** (purpose-built, better at scale).
- **Hybrid retrieval**: BM25 (Postgres `tsvector`) + vector cosine, with a cross-encoder reranker on the top 50.
- Citation contract stays the same — only the scoring changes.

### Step 4 — OCR fleet

[src/lib/localOcr.js](../src/lib/localOcr.js) spawns a local `tesseract` process per image. At scale:

- Tesseract workers run in containers, autoscaled by queue depth.
- Per-page quality gate ([src/lib/quality.js](../src/lib/quality.js)) routes red-band pages to a vision model (Gemini / Claude) — the BYOK boundary is already defined in [src/lib/providers.js](../src/lib/providers.js).
- Cache OCR results keyed by content hash so re-uploads are free.

### Step 5 — Schema profiles as managed contracts

The profiles in [src/lib/schemaProfiles.js](../src/lib/schemaProfiles.js) are heuristic-based today. At scale:

- Each profile becomes a versioned **JSON Schema** (`$id`, `$schema`, semver).
- Server validates extracted fields against the schema before returning — failed validation triggers BYOK fallback for that field.
- Tenants can author their own profiles and store them in Postgres.
- Use a small LLM call (Haiku) for hard-to-regex fields once profiles are stable.

### Step 6 — Edit-learning that actually learns

Today [src/lib/editLearning.js](../src/lib/editLearning.js) appends classified lessons to a list. At scale:

- Embed each lesson; at draft time, retrieve the top-K relevant lessons for the document type + tenant.
- Inject them into the draft prompt as few-shot examples (poor-man's prompt tuning).
- Only consider real fine-tuning once you have ≥1000 high-quality edits in a stable schema — fine-tuning is the wrong answer until then.

### Step 7 — Observability

Quality metrics already exist ([src/lib/quality.js:49-68](../src/lib/quality.js#L49-L68)). Add:

- Structured JSON logs at every stage transition (`document_id`, `tenant_id`, `stage`, `provider`, `duration_ms`, `quality_band`).
- OpenTelemetry traces per document through OCR → retrieve → draft.
- Grafana dashboards: confidence band distribution, fallback rate, paid-API spend per tenant.

### Step 8 — Multi-tenant + audit

- Auth at the edge (Auth0 / Clerk / self-hosted Keycloak).
- Per-org BYOK keys, encrypted at rest, rotated by policy.
- Append-only audit log of every BYOK call: `tenant_id`, `provider`, `document_id`, `page`, `cost_estimate`, `timestamp`.

### What I'd actually build first

If I had one sprint: **Step 1 (queue) + Step 3 (pgvector hybrid retrieval)**. Those two unlock everything else and turn this from a demo into a thing you can hand to a real intake team.
