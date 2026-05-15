# Local-First Document Ingestion

Runnable MVP for messy document intake, local quality review, grounded drafting, BYOK fallback boundaries, and reviewer edit learning. Everything runs on `localhost`; no cloud calls happen unless you explicitly add a BYOK key.

> **Reviewing this submission?** Read [`docs/SUBMISSION_NOTES.md`](docs/SUBMISSION_NOTES.md) first — it answers the three questions reviewers typically ask: is the BYOK key safe, is this a RAG / did you train a model, and how would you scale it.

## Quickstart (60 seconds, zero install required)

Requires Node 20+. From the repo root:

```bash
cp .env.example .env
npm install
npm run dev
```

Then open <http://127.0.0.1:3000>.

`npm install` is a no-op (the app uses only Node built-ins). The server logs `Local-first ingestion app running at http://127.0.0.1:3000` when ready.

## Try It (using bundled sample inputs)

The repo ships with two sample input packs you can drag into the UI immediately:

- `inputs/legal-demo/` — clean and noisy PDFs/JPGs (notice, scan, summons, debt letter).
- `inputs/handwritten-analytical-positivism/images/` — 5 handwritten JPG pages with **curated transcripts** so the demo produces real grounded text even without an OCR engine installed.

Recommended first run:

1. **Upload** — drag `inputs/handwritten-analytical-positivism/images/page-04-hart-rules.jpg` into the drop zone (or click *Upload from computer*).
2. **Run ingestion** — click the button. You should see:
   - *Quality Dashboard* fills in with a confidence band and per-page metrics.
   - *Structured Extraction* shows extracted title/dates/parties.
   - *Page Text* shows the actual extracted Hart text.
3. **Generate draft** — pick a draft type (e.g. *Case fact summary*), click *Generate draft*. The textarea fills with a grounded draft.
4. **Download ZIP** — exports `result.json`, `result.md`, `draft.md`, and `metrics.csv`.

## Uploading Your Own Images (requires Tesseract)

For images that aren't in the curated sample pack, the app uses local Tesseract OCR. There are two ways to install it:

**From the UI** — open the *OCR and BYOK Settings* section (Step 5). If Tesseract is missing, click *Install local OCR*. On macOS this runs `brew install tesseract` for you and takes 1–3 minutes.

**From the command line:**

```bash
brew install tesseract           # macOS
sudo apt-get install tesseract-ocr  # Debian/Ubuntu
```

Restart `npm run dev` after install. If you upload an image without Tesseract installed *and* the filename doesn't match a curated transcript, the UI honestly reports `OCR not installed` instead of fabricating a confidence score.

## JSON Schema Profiles

The *JSON schema* dropdown in the upload bar lets you shape the extracted JSON to the document type. Profiles:

| Profile | Fields |
|---|---|
| `auto` (default) | Detects from filename + page text; falls back to `generic`. |
| `legal_notice` | title, dates, amounts, addresses, parties, deadlines |
| `book_page` | title, author, chapter, page_number, headings, key_terms, quotations, citations |
| `receipt_invoice` | vendor, invoice_number, date, total, currency, tax, line_items, address |
| `study_note` | topic, key_concepts, definitions, thinkers_mentioned, references, headings |
| `generic` | title, dates, names, numbers, headings |

Change the profile after upload to re-extract without re-uploading. The chosen profile is also reflected in the ZIP's `result.json` and `result.md`.

## Plain-Text Export

- *Download text* (next to *Download ZIP*) returns just the extracted text per page — one `=== <file> page <n> ===` header per page, no metadata.
- `extracted_text.txt` is also bundled inside the ZIP alongside `result.json`, `metrics.csv`, `result.md`, and `draft.md`.
- API: `GET /api/documents/:id/text` returns `text/plain` directly.

## BYOK Vision Fallback (optional)

You can add Gemini or Claude vision keys to improve OCR quality on low-confidence pages. Either:

- Edit `.env` and set `GEMINI_API_KEY` or `ANTHROPIC_API_KEY`, restart the server, OR
- Paste keys into the *BYOK Vision Fallback* form in the UI (Step 5). Keys are stored server-side in `data/store.json` (gitignored); the browser only ever sees a redacted status.

After upload, if a page has low confidence, the *Run BYOK fallback* button becomes active.

## Generating the Bundled Result Artifacts

To regenerate the committed sample outputs under `results/`:

```bash
npm run results
```

Produces:

- `results/legal-demo/actual_case_fact_summary.md`
- `results/legal-demo/model-confidence-results.csv`
- `results/legal-demo/evaluation-report.md`
- `results/handwritten-analytical-positivism/actual-study-note-summary.md`
- `results/handwritten-analytical-positivism/evaluation-report.md`
- `results/model-confidence.md`, `results/model-confidence.csv`

## All Scripts

```bash
npm run dev         # start the server
npm run ingestion   # start and auto-open the browser
npm run start       # alias for dev
npm test            # run node:test suite
npm run build       # build-time sanity check
npm run results     # regenerate sample result artifacts
npm run samples     # alias for results
```

## What's Inside

Build order implemented:

1. **Repo/config** — package scripts, `.env.example`, static UI, local JSON store.
2. **Intake/normalization** — PDF, PNG, JPG, TIFF, DOCX, TXT, MD via the browser.
3. **OCR/quality** — local Tesseract OCR (auto-installable), heuristic confidence/coverage, green/amber/red bands.
4. **BYOK fallback** — Gemini/Claude provider boundary with server-side key checks and redacted UI status.
5. **Retrieval/grounding** — chunking, term retrieval, citations with file/page/source spans.
6. **Drafting** — six draft types with required sections and unsupported-claim warnings.
7. **Edit learning** — captures reviewer edits, classifies them, stores reusable lessons.
8. **QA/docs** — `node:test` coverage, spec, playbook, journal.
9. **Operator UI/export** — drag-drop, file validation, loader/toasts, JSON payload, metrics table, ZIP export.

## UI Walkthrough

| Step | Section | What it does |
| --- | --- | --- |
| 1 | Upload and Normalize | Drag/drop or click; 10 MB cap per file. Validates before sending. |
| 2 | Quality Dashboard | Per-page OCR confidence, coverage, band. *Run BYOK fallback* when red. |
| 3 | Structured Extraction | Inferred title, dates, amounts, addresses, parties, deadlines. |
| 4 | Grounded Draft | Pick a draft type, generate, capture reviewer edits as lessons. |
| 5 | OCR and BYOK Settings | Install local OCR, paste BYOK keys, switch fallback mode. |

## Notes

- BYOK keys never reach the browser. Storage is `data/store.json` (gitignored) or `.env`.
- The app blocks paid fallback if no matching BYOK key is configured.
- Uploaded files and runtime state live in `data/` (gitignored).
- See `env/README.md` and `docs/GUARDRAILS.md` for the secret-handling boundary.
