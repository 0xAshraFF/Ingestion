import test from "node:test";
import assert from "node:assert/strict";
import { ingestDocument } from "../src/lib/intake.js";
import { chunkDocument } from "../src/lib/retrieval.js";
import { generateDraft } from "../src/lib/drafts.js";
import { captureEdit } from "../src/lib/editLearning.js";
import { runPaidFallback } from "../src/lib/providers.js";

test("generates grounded draft with citation metadata", () => {
  const document = ingestDocument({
    files: [
      {
        name: "case.txt",
        type: "text/plain",
        size: 200,
        text: "Case facts: Tenant Jane Rivera received notice on 2026-04-10. The amount due is $1,250.00. The response deadline is 2026-04-20."
      }
    ]
  });
  const chunks = chunkDocument(document);
  const draft = generateDraft({ document, chunks, type: "Case fact summary" });

  assert.match(draft.content, /Known facts/);
  assert.equal(draft.citations.length > 0, true);
  assert.equal(draft.citations[0].source, "case.txt");
});

test("generates study note summaries for jurisprudence notes", () => {
  const document = ingestDocument({
    files: [
      {
        name: "analytical-positivism.jpg",
        type: "image/jpeg",
        size: 500,
        ocrText: "Analytical positivism asks what law is. Austin gave command theory of law. Bentham discussed utilitarianism. Hart discussed primary and secondary rules. Kelsen gave pure theory of law and grundnorm."
      }
    ]
  });
  const draft = generateDraft({
    document,
    chunks: chunkDocument(document),
    type: "Study note summary"
  });

  assert.match(draft.content, /Study note summary/);
  assert.equal(draft.citations.length > 0, true);
});

test("captures reviewer edits as reusable lessons", () => {
  const document = ingestDocument({
    files: [{ name: "case.txt", type: "text/plain", size: 50, text: "Timeline: First notice was mailed. Then payment arrived." }]
  });
  const event = captureEdit({
    document,
    draftId: "draft-1",
    before: "Payment arrived.",
    after: "First the notice was mailed, then payment arrived."
  });

  assert.equal(event.editType, "format");
  assert.match(event.reusableLesson, /chronological/);
});

test("paid fallback requires BYOK and improves page quality when configured", () => {
  const document = ingestDocument({
    files: [{ name: "noisy_scan.png", type: "image/png", size: 99, text: "" }]
  });

  assert.throws(() => runPaidFallback({ page: document.pages[0], providerName: "gemini_byok", env: {} }), /not configured/);

  const improved = runPaidFallback({
    page: document.pages[0],
    providerName: "gemini_byok",
    env: { GEMINI_API_KEY: "test-key" }
  });

  assert.equal(improved.metric.qualityBand, "green");
  assert.equal(improved.metric.fallbackUsed, true);
});
