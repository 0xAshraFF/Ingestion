# Basic Playbook

## 1. Purpose

This playbook explains how to run, test, demo, and troubleshoot the local-first document understanding system.

## 2. Local Setup

Expected setup after implementation:

```bash
cp .env.example .env
# Fill optional BYOK keys only if paid fallback is needed.
npm install
npm run dev
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
2. Upload a clear PDF and a noisy scan.
3. Choose “Case Fact Summary.”
4. Watch local OCR processing complete.
5. Open the quality dashboard.
6. Show green/amber/red page quality.
7. Trigger paid fallback for the low-confidence page.
8. Generate grounded draft.
9. Click citations to inspect evidence.
10. Edit one paragraph.
11. Show edit lesson captured.
12. Regenerate or start a second draft using the improvement lesson.

## 5. Quality Review Checklist

Before trusting output, verify:

- OCR confidence is green or amber with review completed.
- Required fields are present.
- Every major factual claim has a citation.
- Unsupported claims are listed separately.
- Paid fallback usage is visible.
- The draft includes missing information and reviewer warnings.

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

## 7. Release Checklist

- All tests pass.
- `.env.example` has no secrets.
- README explains local setup.
- Sample fixtures are synthetic.
- Demo data can be deleted.
- Fallback provider logs redact keys.
- Quality dashboard shows OCR accuracy clearly.
- Journal and spec files are included.
