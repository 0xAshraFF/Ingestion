# Basic Playbook

## 1. Purpose

This playbook explains how to run, test, demo, and troubleshoot the local-first document understanding system.

## 2. Local Setup

Expected setup after implementation:

```bash
cp .env.example .env
# Fill optional BYOK keys only if paid fallback is needed.
npm install
npm run ingestion
```

Optional local model setup:

```bash
# Example only; final model can be changed before coding.
ollama pull qwen2.5vl
ollama pull llama3.2
```

## 3. BYOK Setup

Add keys server-side:

```bash
GEMINI_API_KEY=your_key_here
GEMINI_VISION_MODEL=gemini-3-flash
ANTHROPIC_API_KEY=your_key_here
CLAUDE_VISION_MODEL=claude-haiku-4-5
PAID_FALLBACK_MODE=ask_each_job
```

Recommended default: `ask_each_job` so the operator controls paid usage.

## 4. Demo Script

1. Open app.
2. Drag a clear PDF, noisy scan, or handwritten note onto the upload area, or click “Upload from computer.”
3. Confirm validation passes. Files larger than 10 MB or unsupported extensions should be rejected.
4. Click “Run ingestion” and show the loader while processing runs.
5. Confirm the completion notification appears.
6. Open the quality dashboard and show green/amber/red page quality.
7. Choose “Case Fact Summary” and generate the grounded draft.
8. Show the database-ready JSON result panel.
9. Show the Markdown-style draft output and citation metadata.
10. Click “Download ZIP” and verify it contains `result.json`, `result.md`, `draft.md`, and `metrics.csv`.
11. Edit one paragraph.
12. Show edit lesson captured.
13. Regenerate or start a second draft using the improvement lesson.

## 5. Quality Review Checklist

Before trusting output, verify:

- OCR confidence is green or amber with review completed.
- Required fields are present.
- Every major factual claim has a citation.
- Unsupported claims are listed separately.
- Paid fallback usage is visible.
- The draft includes missing information and reviewer warnings.
- JSON result payload is available for database ingestion.
- ZIP export includes JSON, Markdown, draft text, and CSV metrics.

## 6. Troubleshooting

### OCR confidence is low

- Check scan rotation.
- Try image preprocessing.
- Use paid BYOK fallback for failed pages.
- Manually correct extracted text if needed.

### Paid model does not run

- Check API key exists server-side.
- Check model name.
- Check fallback mode is not disabled.
- Check rate limit or billing status.

### Draft has unsupported claims

- Re-run retrieval.
- Reduce draft scope.
- Add the claim to “Unsupported or Needs Review.”
- Do not export as clean final without accepting warning.

### Citations point to wrong page

- Rebuild chunks.
- Check PDF page rendering order.
- Check OCR metadata page numbers.

### User edits are not improving output

- Confirm edit events are being stored.
- Confirm reusable lessons are being applied to the selected draft template.
- Review edit classification labels.

### Download ZIP does not start

- Confirm at least one document has been uploaded.
- Generate a draft if the reviewer expects `draft.md` to contain final draft text.
- Check the browser did not block downloads.
- Use `GET /api/documents/:id/export.zip` directly for API verification.

## 7. Release Checklist

- All tests pass.
- `.env.example` has no secrets.
- README explains local setup.
- Sample fixtures are synthetic.
- Demo data can be deleted.
- Fallback provider logs redact keys.
- Quality dashboard shows OCR accuracy clearly.
- Upload validation rejects oversized files.
- Loader and completion notification appear during upload/draft generation.
- Downloaded ZIP opens and contains JSON, Markdown, draft, and metrics CSV.
- Journal and spec files are included.
