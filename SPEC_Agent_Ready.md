# Agent-Ready Spec File

Project: Local-First Document Understanding, Grounded Drafting, and Edit Improvement
Version: 1.0
Status: Ready for implementation planning; no coding has started.

## 0. Prime Directive for Agents

Build the system task-by-task without asking the owner for routine decisions. Use the defaults in this spec. Ask the owner only when a decision affects legal risk, data retention, paid API usage behavior, or the demo scope.

The system must run locally first. It must call paid vision models only when the local path fails quality gates or when the operator explicitly requests paid fallback. Paid models must use BYOK keys supplied by the user.

## 1. Problem Statement

The office receives messy legal-style documents: scanned PDFs, handwritten notes, screenshots, photos, partially legible records, and inconsistent forms. The system must ingest them, extract usable content, ground later answers in source evidence, generate first-pass drafts, and improve from operator edits.

## 2. Target Users

- Intake operator: uploads documents and checks quality.
- Reviewer/analyst: reviews source evidence and edits output.
- Admin: configures local and BYOK model providers.

## 3. In-Scope MVP

- Upload PDF, PNG, JPG, JPEG, TIFF, DOCX, TXT.
- Render PDFs to images page-by-page.
- Preprocess images: deskew, denoise, rotate, crop margins, contrast normalization.
- Local OCR with confidence scores.
- Structured extraction: document title, dates, parties, addresses, amounts, deadlines, named entities, page references.
- Local embeddings and vector retrieval.
- Grounded draft generation with citations to source document, page, and text span.
- Quality dashboard visible to user.
- BYOK Gemini and Claude vision fallback configuration.
- Edit capture and prompt/template improvement loop.
- Test fixtures, unit tests, integration tests, and end-to-end demo flow.

## 4. Out of Scope for MVP

- Final legal advice.
- E-signatures or court filing.
- Native mobile app.
- Multi-tenant billing.
- Training a custom OCR model.
- Long-term storage of raw sensitive documents unless explicitly enabled.

## 5. Architecture

```text
Upload UI
  -> File Intake Service
  -> PDF/Image Normalizer
  -> Local OCR + Local Vision/LLM Adapter
  -> Quality Gate
       -> if pass: proceed
       -> if fail and BYOK enabled: paid vision fallback per failed page/field
       -> if fail and no BYOK: warn user and continue only with degraded flag
  -> Document Chunker
  -> Local Embedding Store
  -> Retrieval Engine
  -> Grounded Draft Generator
  -> Citation Verifier
  -> Review/Edit UI
  -> Edit Learning Store
  -> Metrics Dashboard
```

## 6. Provider Strategy

### 6.1 Provider Interface

Create a common provider interface:

```ts
interface VisionTextProvider {
  name: string;
  isAvailable(): Promise<boolean>;
  extract(input: ProviderInput): Promise<ProviderExtractionResult>;
}

interface DraftProvider {
  name: string;
  isAvailable(): Promise<boolean>;
  generate(input: DraftInput): Promise<DraftResult>;
}
```

### 6.2 Default Provider Order

1. local_ocr
2. local_vision_llm
3. gemini_byok
4. claude_byok

### 6.3 BYOK Environment Variables

```bash
GEMINI_API_KEY=
GEMINI_VISION_MODEL=gemini-3-flash
ANTHROPIC_API_KEY=
CLAUDE_VISION_MODEL=claude-haiku-4-5
PAID_FALLBACK_MODE=ask_each_job # ask_each_job | auto_when_key_exists | disabled
PAID_FALLBACK_BUDGET_USD_PER_JOB=1.00
```

Keep keys server-side only. Never expose keys to the browser. Redact keys in logs.

## 7. Fallback Algorithm

Fallback must be page-level and field-level.

```text
For each document page:
  Run local preprocessing and OCR.
  Calculate OCR confidence, coverage, and extraction completeness.
  If all quality gates pass:
    mark page as local_pass.
  Else:
    mark page as local_low_confidence.
    If BYOK keys exist and policy allows paid fallback:
      send only failed page/image or field crop to paid provider.
      merge paid extraction with local extraction.
      record provider, cost estimate, timestamp, and reason.
    Else:
      continue with warning and degraded quality flag.
```

Trigger paid fallback when any of these conditions is true:

- OCR confidence < 75.
- More than 20% of page has no recognized text but image is not blank.
- Required field is missing for selected draft type.
- Retrieval returns no evidence for a generated claim.
- Local model returns malformed JSON twice.
- User manually clicks “Improve with paid model”.

## 8. OCR Quality Metrics

### 8.1 Metrics to Store

```json
{
  "document_id": "uuid",
  "page": 1,
  "provider": "local_ocr|gemini_byok|claude_byok",
  "ocr_confidence": 87.4,
  "word_count": 924,
  "low_confidence_word_count": 51,
  "page_coverage": 0.93,
  "field_completeness": 0.91,
  "fallback_used": false,
  "quality_band": "green|amber|red"
}
```

### 8.2 Dashboard Bands

- Green: OCR confidence >= 90 and coverage >= 95%.
- Amber: OCR confidence 75-89 or coverage 80-94%.
- Red: OCR confidence < 75 or coverage < 80%.

### 8.3 User-Facing Warning

When quality drops, show:

> Extraction quality is low on pages 2 and 5. Review the highlighted text before using this draft. Paid BYOK fallback is available for these pages.

## 9. Retrieval and Grounding

### 9.1 Chunking

- Chunk by page, heading, paragraph, and table boundaries.
- Target chunk size: 500-900 tokens.
- Keep metadata: source file, page, bounding box when available, OCR confidence, extraction provider.

### 9.2 Retrieval

- Use local embedding model by default.
- Return top-k chunks with reranking.
- Do not draft from memory. Draft only from retrieved evidence.

### 9.3 Citation Format

Every factual claim must carry source metadata:

```json
{
  "claim": "Tenant received notice on 2026-04-10.",
  "source": "notice_scan.pdf",
  "page": 2,
  "quote_or_span": "Notice dated April 10, 2026",
  "confidence": 0.91
}
```

If no evidence exists, place it under “Unsupported or Needs Review.”

## 10. Draft Generation

Supported outputs:

1. Review summary.
2. Case fact summary.
3. Notice-related summary.
4. Document checklist.
5. First-pass internal memo.

Draft rules:

- Use concise headings.
- Include “Known facts,” “Potential issues,” “Missing information,” and “Source evidence.”
- Never claim legal conclusion unless directly supported.
- Mark uncertainty explicitly.
- Include a reviewer warning when quality band is amber or red.

## 11. Improvement from Edits

Capture edit events:

```json
{
  "draft_id": "uuid",
  "before": "original sentence",
  "after": "edited sentence",
  "edit_type": "tone|missing_fact|incorrect_fact|format|citation|clarity",
  "accepted": true,
  "reusable_lesson": "Prefer chronological ordering in case fact summaries."
}
```

Use edits to update:

- Prompt templates.
- Draft structure preferences.
- Extraction rules.
- Citation validation rules.

Never store sensitive raw snippets in long-term learning unless the admin enables it. Store generalized lessons by default.

## 12. Data Model

Core tables/collections:

- documents
- pages
- extraction_results
- quality_metrics
- chunks
- retrieval_runs
- drafts
- draft_claims
- citations
- edit_events
- provider_calls
- app_settings

## 13. API Endpoints

```text
POST /api/documents/upload
GET  /api/documents/:id/status
GET  /api/documents/:id/extractions
GET  /api/documents/:id/quality
GET  /api/documents/:id/result
GET  /api/documents/:id/export.zip
POST /api/documents/:id/fallback
POST /api/drafts
GET  /api/drafts/:id
PATCH /api/drafts/:id
POST /api/drafts/:id/edits
GET  /api/settings/providers
PATCH /api/settings/providers
```

## 14. UI Requirements

Pages:

- Upload page.
- Drag-and-drop upload target.
- Upload-from-computer control.
- Processing status page.
- Extraction review page with low-confidence highlights.
- Quality dashboard.
- Draft generator page.
- Draft review/edit page.
- BYOK provider settings page.

Quality dashboard must show:

- Overall quality band.
- Per-page confidence.
- Fallback usage.
- Unsupported claim count.
- Citation coverage.
- Edit delta after review.

Upload UI must:

- Validate supported file extensions before ingestion.
- Reject files larger than 10 MB.
- Show a loader during upload and draft generation.
- Notify the user when ingestion or draft generation completes.
- Show a JSON result payload suitable for later database ingestion.
- Provide a ZIP export containing `result.json`, `result.md`, `draft.md`, and `metrics.csv`.
- Use curated transcripts for the included handwritten sample JPGs when uploaded by their known filenames.

## 15. Error Handling

- OCR crash: retry once with safer preprocessing, then mark failed.
- Local model unavailable: continue OCR-only or ask for paid fallback.
- Paid API key invalid: show setup error, do not retry repeatedly.
- Rate limit: exponential backoff and show “paid provider delayed.”
- Malformed model JSON: repair once; if still invalid, retry with stricter schema prompt; then fallback.
- Missing citations: block final draft export until user accepts warning.

## 16. Security and Privacy

- BYOK keys encrypted at rest or stored in local env only.
- No keys in frontend, logs, or exported files.
- Raw document retention configurable.
- Delete job data from UI.
- Basic audit log for fallback calls and edits.
- Redact PII in debug logs.

## 17. Testing Plan

### Unit Tests

- File type validation.
- Maximum file-size validation.
- OCR confidence calculation.
- Provider fallback selection.
- JSON schema validation.
- Citation format validation.
- Edit event classification.
- Export bundle generation.
- Curated transcript lookup for known handwritten sample images.

### Integration Tests

- Upload PDF -> local OCR -> chunks -> draft.
- Low-confidence scan -> paid fallback path mocked.
- Invalid BYOK key -> graceful error.
- Draft claim with no evidence -> unsupported warning.
- Operator edit -> reusable lesson stored.

### End-to-End Tests

- Happy path: clear PDF to review summary.
- Noisy scan path: local fail to paid fallback to draft.
- Missing key path: local fail to degraded dashboard warning.
- Edit learning path: first draft edited, second draft improves formatting.

## 18. Acceptance Criteria

The project is complete when:

- A user can upload a messy document bundle.
- The app extracts text and structured fields locally.
- The user can see OCR quality and accuracy warnings.
- Low-quality pages can be sent to Gemini or Claude with BYOK keys.
- Generated drafts include citations and unsupported claim warnings.
- The UI supports drag/drop and upload-from-computer workflows.
- The UI shows loader and completion notifications.
- The UI shows JSON results and metrics tables.
- The user can download a ZIP containing JSON, Markdown, draft text, and CSV metrics.
- User edits are captured and summarized into reusable improvements.
- All tests pass locally.
- README, spec, playbook, and journal are included.

## 19. Agent Task List

### Agent 1: Repo and Config

Create project skeleton, environment config, provider interfaces, logging, and test runner.

Done when:
- Repo runs locally.
- `.env.example` exists.
- Provider interface tests pass.

### Agent 2: Intake and Normalization

Build upload flow, PDF rendering, image preprocessing, and file metadata storage.

Done when:
- PDF/images produce normalized page images.
- Unsupported files are rejected safely.

### Agent 3: OCR and Quality

Build local OCR adapter, confidence calculation, quality dashboard API.

Done when:
- Per-page OCR confidence is stored.
- Low-confidence pages are flagged.

### Agent 4: BYOK Paid Fallback

Build Gemini and Claude adapters behind common interface. Add fallback policy.

Done when:
- Mocked paid provider tests pass.
- Invalid key handling works.
- Per-page fallback records are stored.

### Agent 5: Retrieval and Grounding

Build chunker, embedding store, retrieval, citation metadata, and claim verifier.

Done when:
- Draft inputs include cited evidence spans.
- Unsupported claims are blocked or flagged.

### Agent 6: Draft Generation

Build template-based drafting for five output types.

Done when:
- Drafts have required sections.
- Draft facts cite source evidence.

### Agent 7: Edit Learning

Build edit capture, edit classification, reusable lesson store, and prompt adjustment.

Done when:
- Edits are stored and summarized.
- Future drafts can use stored style/structure lessons.

### Agent 8: QA and Documentation

Write fixtures, tests, README, playbook, and demo script.

Done when:
- Unit/integration/E2E tests pass.
- Demo can be run from README.

## 20. Questions for Owner Before Coding

1. Should the demo focus on legal notice summaries, case fact summaries, or first-pass memos?
2. Should paid fallback be automatic when API keys exist, or always ask first?
3. What languages must OCR support on day one: English only, Bengali only, or mixed?
4. Is Docker allowed in the office submission environment?
5. Should document data be deleted after each demo run by default?
