import test from "node:test";
import assert from "node:assert/strict";
import { ingestDocument, extractStructuredFields, MAX_FILE_SIZE_BYTES } from "../src/lib/intake.js";

test("ingests text files into local-pass pages with extracted fields", () => {
  const document = ingestDocument({
    files: [
      {
        name: "notice.txt",
        type: "text/plain",
        size: 180,
        text: "Notice dated 2026-04-10\nTenant: Jane Rivera\nLandlord: Malik Stone\nAmount due: $1,250.00\nRespond by 2026-04-20. The notice describes the lease file, payment history, property address, requested response, and reviewer notes. The document includes enough typed content for local extraction confidence to remain high during the demo workflow."
      }
    ]
  });

  assert.equal(document.pages.length, 1);
  assert.equal(document.pages[0].status, "local_pass");
  assert.equal(document.pages[0].metric.qualityBand, "green");

  const fields = extractStructuredFields(document);
  assert.deepEqual(fields.dates, ["2026-04-10", "2026-04-20"]);
  assert.deepEqual(fields.amounts, ["$1,250.00"]);
  assert.ok(fields.parties.some((party) => party.includes("Jane Rivera")));
});

test("flags noisy image uploads as low confidence", () => {
  const document = ingestDocument({
    files: [
      {
        name: "noisy_handwritten_scan.jpg",
        type: "image/jpeg",
        size: 1024,
        text: ""
      }
    ]
  });

  assert.equal(document.pages.length, 1);
  assert.equal(document.pages[0].status, "local_low_confidence");
  assert.equal(document.pages[0].metric.qualityBand, "red");
});

test("rejects unsupported file types", () => {
  assert.throws(() => ingestDocument({
    files: [{ name: "archive.zip", type: "application/zip", size: 9, text: "" }]
  }), /Unsupported file type/);
});

test("rejects files larger than the configured upload limit", () => {
  assert.throws(() => ingestDocument({
    files: [{ name: "large.pdf", type: "application/pdf", size: MAX_FILE_SIZE_BYTES + 1, text: "large" }]
  }), /File is too large/);
});
