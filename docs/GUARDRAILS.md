# Production Guardrails

This project is a local-first document understanding demo. These guardrails keep the implementation reviewable, safer to run, and suitable for an open-source repository.

## Secrets And Environment

- Never commit real API keys, tokens, credentials, or provider secrets.
- Keep local secrets in `.env` or files under `env/`; both are ignored except `env/README.md`.
- Commit only `.env.example` with blank or fake values.
- Provider keys must stay server-side. Browser code must never read `GEMINI_API_KEY`, `ANTHROPIC_API_KEY`, or similar secrets.
- Logs must show only redacted key state such as `missing`, `set`, or `invalid-looking`.

## Data Privacy

- Use synthetic or public documents for demos.
- Do not commit real client, court-party, medical, financial, or student records unless they are explicitly public and appropriate for redistribution.
- Redact visible phone numbers, addresses, account numbers, and personal identifiers when they are not needed for the demo.
- Store temporary runtime uploads under `data/`; this folder is ignored by git.
- Generated outputs must warn when extraction quality is amber or red.

## Grounding And Drafting

- Drafts must be generated from retrieved source chunks, not model memory.
- Every material factual claim should include source document and page metadata where available.
- Unsupported claims belong in an explicit missing-information or needs-review section.
- Low-confidence handwritten or noisy image inputs must not be presented as clean extraction.

## Paid Fallback

- Paid BYOK providers are optional and disabled unless configured by the operator.
- Fallback should operate at page or field level, not by sending entire bundles unnecessarily.
- Record provider name, reason, timestamp, and quality change for fallback calls.
- Respect `PAID_FALLBACK_MODE` and `PAID_FALLBACK_BUDGET_USD_PER_JOB`.

## Evaluation

- Keep source files under `inputs/`.
- Keep generated drafts, reports, and metrics under `results/`.
- Report model or adapter used, confidence metric, quality band, fallback usage, and citation count.
- Treat confidence as an extraction-quality proxy unless a ground-truth benchmark is available.

## Git Hygiene

- Work on feature branches and open a pull request before merging to `main`.
- Run `npm run samples`, `npm test`, and `npm run build` before pushing.
- Review `git status --ignored` before committing to confirm secrets and runtime data are excluded.
