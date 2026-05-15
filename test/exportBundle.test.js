import test from "node:test";
import assert from "node:assert/strict";
import { ingestDocument } from "../src/lib/intake.js";
import { chunkDocument } from "../src/lib/retrieval.js";
import { generateDraft } from "../src/lib/drafts.js";
import { buildDocumentResult, buildResultZip, metricsCsv, resultMarkdown, plainTextDump } from "../src/lib/exportBundle.js";

test("builds database-ready result payload and downloadable zip", () => {
  const document = ingestDocument({
    files: [{
      name: "notice.txt",
      type: "text/plain",
      size: 160,
      text: "Notice dated 2026-04-10. Tenant: Jane Rivera. Amount due: $1,250.00. Respond by 2026-04-20. The record is typed and ready for extraction."
    }]
  });
  const chunks = chunkDocument(document);
  generateDraft({ document, chunks, type: "Case fact summary" });

  const result = buildDocumentResult({ document, chunks });
  assert.equal(result.document.id, document.id);
  assert.equal(result.quality.pages.length, 1);
  assert.ok(result.latestDraft.content.includes("Case fact summary"));

  const csv = metricsCsv(result);
  assert.match(csv, /input_doc,model_used|input_doc,page,model_used/);
  assert.match(resultMarkdown(result), /Structured Fields/);

  const zip = buildResultZip(result);
  assert.equal(zip.readUInt32LE(0), 0x04034b50);
  assert.ok(zip.includes(Buffer.from("result.json")));
  assert.ok(zip.includes(Buffer.from("metrics.csv")));
  assert.ok(zip.includes(Buffer.from("extracted_text.txt")));
});

test("plainTextDump emits one page header per page plus body text", () => {
  const document = ingestDocument({
    files: [{
      name: "notice.txt",
      type: "text/plain",
      size: 120,
      text: "Page one body content here.\fPage two body content here too."
    }]
  });
  const dump = plainTextDump(document);
  assert.match(dump, /=== notice\.txt — page 1 ===/);
  assert.match(dump, /=== notice\.txt — page 2 ===/);
  assert.match(dump, /Page one body content/);
  assert.match(dump, /Page two body content/);
});
