# Local-First Document Ingestion

Runnable MVP for messy document intake, local quality review, grounded drafting, BYOK fallback boundaries, and reviewer edit learning.

## Run Locally

```bash
cp .env.example .env
npm install
npm run dev
```

Open `http://localhost:3000`.

This implementation uses only Node built-ins, so `npm install` is currently a no-op aside from creating the normal npm metadata. Native OCR, PDF rasterization, and paid model calls are represented by deterministic local adapters until those engines are wired in.

## Build Order Implemented

1. Repo/config: package scripts, `.env.example`, static UI, local JSON store.
2. Intake/normalization: accepts PDF, PNG, JPG, TIFF, DOCX, TXT, and MD through the browser.
3. OCR/quality: local heuristic OCR confidence, coverage, completeness, and green/amber/red bands.
4. BYOK fallback: Gemini/Claude provider boundary with server-side key checks and redacted settings.
5. Retrieval/grounding: chunking, term retrieval, citations with file/page/source spans.
6. Drafting: five draft types with required sections and unsupported-claim warnings.
7. Edit learning: captures edits, classifies them, and stores reusable draft lessons.
8. QA/docs: focused `node:test` coverage plus the original spec, playbook, and journal.

## Scripts

```bash
npm run dev
npm run build
npm test
npm run results
npm run samples
```

## Inputs And Results

The `inputs` folder contains two demo input packs:

- `inputs/legal-demo`: clear notice PDF, noisy scan JPG, handwritten operator note JPG, debt collection letter PDF, civil summons PDF, plus OCR/source text used for deterministic local runs.
- `inputs/handwritten-analytical-positivism`: handwritten JPG pages and redacted manual OCR transcripts.

Run:

```bash
npm run results
```

That command builds grounded drafts from both input packs and writes actual outputs under `results`:

- `results/legal-demo/actual_case_fact_summary.md`
- `results/legal-demo/model-confidence-results.csv`
- `results/legal-demo/evaluation-report.md`
- `results/handwritten-analytical-positivism/actual-study-note-summary.md`
- `results/handwritten-analytical-positivism/evaluation-report.md`
- `results/model-confidence.md`
- `results/model-confidence.csv`

The source inputs stay separate from generated results so reviewers can inspect the document-understanding path clearly.

## Notes

- BYOK keys stay server-side in `.env`.
- The app blocks paid fallback if no matching BYOK key is configured.
- Uploaded/demo data is stored under `data/store.json`, which is ignored by git.
- Local secret files are ignored by git. See `env/README.md` and `docs/GUARDRAILS.md`.
