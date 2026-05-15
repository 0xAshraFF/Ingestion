# Build Journal

Project: Local-First Document Understanding and Grounded Drafting

## Journal Entry 001 - Requirement Intake

The assessment asks for a system that can ingest messy legal-style documents, extract useful content, retrieve relevant evidence, generate grounded drafts, and improve from operator edits. The primary risk is not generation; it is building enough trust in the extraction, retrieval, and citation chain.

Decision: Build a local-first architecture with paid BYOK fallback. This satisfies cost control, privacy, and reliability.

## Journal Entry 002 - Scope Selection

Selected MVP outputs:

- Review summary.
- Case fact summary.
- Notice-related summary.
- Document checklist.
- First-pass memo.

Reason: These outputs are explicitly aligned with the assessment and are practical for demo review.

## Journal Entry 003 - Local-First Design

The system will run OCR and extraction locally first. Local failure does not mean the whole job fails. Instead, the system marks the page or field as low-confidence and optionally escalates only that portion to a paid model.

Reason: Page-level fallback is cheaper and easier to justify than sending the full file to a paid model every time.

## Journal Entry 004 - BYOK Decision

Gemini and Claude vision adapters will be configured using user-owned API keys. Keys are never exposed to the browser and are redacted from logs.

Reason: The office can test paid performance without the developer owning API spend or data routing decisions.

## Journal Entry 005 - Quality Metrics

Quality is not hidden. The user sees OCR confidence, page coverage, field completeness, fallback usage, citation coverage, unsupported claim count, and edit delta.

Reason: This addresses the rubric's emphasis on OCR quality, grounding, and improvement from edits.

## Journal Entry 006 - Grounding Decision

Drafts must be generated only from retrieved evidence. Unsupported facts go into a dedicated warning section.

Reason: The assessment explicitly says the system should not hallucinate unsupported content.

## Journal Entry 007 - Edit Improvement Loop

The first implementation will capture edits and summarize them into reusable lessons. It will not train a new model.

Reason: Prompt/template improvement is safer and realistic for an MVP.

## Journal Entry 008 - Testing Strategy

Use synthetic but realistic fixtures: clear PDF, noisy scan, handwritten note, mixed screenshot, missing key fallback, invalid key fallback, unsupported claim, and edit improvement.

Reason: Synthetic data avoids sensitive material while proving the workflow.

## Journal Entry 009 - Implementation Order

Build order:

1. Repo/config.
2. Intake/normalization.
3. OCR/quality.
4. BYOK fallback.
5. Retrieval/grounding.
6. Drafting.
7. Edit learning.
8. Tests/docs/demo.

Reason: This order makes every later stage testable and prevents generation from being built before extraction is reliable.

## Journal Entry 010 - Pre-Coding Approval Questions

Before coding, confirm:

- Default demo draft type.
- Auto vs manual paid fallback.
- Day-one OCR languages.
- Local runtime allowed in the office environment.
- Data retention policy for demo files.

## Journal Entry 011 - Operator Upload and Export Flow

Added a basic operator UI focused on the submission demo path: drag-and-drop upload, upload-from-computer control, client and server max-size validation, loader state, completion notifications, JSON result display, metrics table, and ZIP export.

Decision: Keep the implementation dependency-free and local-first. The ZIP export is generated with Node buffers and includes `result.json`, `result.md`, `draft.md`, and `metrics.csv`.

Reason: The reviewer can inspect both machine-readable output for future database storage and human-readable outputs for assessment without needing extra services.

## Journal Entry 012 - Run Command

Added `npm run ingestion` as the primary demo command. It starts the local server and attempts to open the browser UI.

Reason: The requested operator experience is one command followed by an upload-ready UI.
