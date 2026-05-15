import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { ingestDocument, extractStructuredFields } from "../src/lib/intake.js";
import { chunkDocument } from "../src/lib/retrieval.js";
import { generateDraft } from "../src/lib/drafts.js";
import { aggregateQuality } from "../src/lib/quality.js";

const sampleDir = "samples/legal-demo";
const manifest = JSON.parse(await readFile(join(sampleDir, "manifest.json"), "utf8"));

const files = await Promise.all(manifest.documents.map(async (doc) => {
  const text = await readFile(join(sampleDir, doc.text), "utf8");
  const isImage = doc.type.startsWith("image/");
  return {
    name: doc.sampleDoc,
    type: doc.type,
    size: text.length,
    text: isImage ? "" : text,
    ocrText: isImage ? text : undefined
  };
}));

const document = ingestDocument({ files });
const chunks = chunkDocument(document);
const fields = extractStructuredFields(document);
const draft = generateDraft({
  document,
  chunks,
  type: manifest.draftType,
  lessons: [
    {
      reusableLesson: "For case fact summaries, list dates, parties, amounts, and uncertainty before drafting conclusions."
    }
  ]
});
const quality = aggregateQuality(document.pages.map((page) => page.metric));

const rows = manifest.documents.map((sourceDoc, index) => {
  const page = document.pages[index];
  const confidence = page.metric.ocrConfidence;
  return {
    sampleDoc: sourceDoc.sampleDoc,
    modelUsed: sourceDoc.modelUsed,
    confidenceMetric: `${confidence}%`,
    accuracyProxy: `${Math.round(Math.min(confidence, sourceDoc.expectedConfidence))}%`,
    qualityBand: page.metric.qualityBand,
    fallbackUsed: page.metric.fallbackUsed ? "yes" : "no"
  };
});

const table = [
  "| sample doc | model used | confidence metric | accuracy proxy | quality band | fallback used |",
  "|---|---:|---:|---:|---:|---:|",
  ...rows.map((row) => `| ${row.sampleDoc} | ${row.modelUsed} | ${row.confidenceMetric} | ${row.accuracyProxy} | ${row.qualityBand} | ${row.fallbackUsed} |`)
].join("\n");

const csv = [
  "sample_doc,model_used,confidence_metric,accuracy_proxy,quality_band,fallback_used",
  ...rows.map((row) => [
    row.sampleDoc,
    row.modelUsed,
    row.confidenceMetric,
    row.accuracyProxy,
    row.qualityBand,
    row.fallbackUsed
  ].join(","))
].join("\n");

const report = `# Legal Demo Results

Sample: ${manifest.name}

## Model and Confidence Metrics

${table}

## Overall Metrics

- Overall quality band: ${quality.band}
- Average OCR confidence: ${quality.averageConfidence}%
- Pages processed: ${document.pages.length}
- Citations generated: ${draft.citations.length}
- Unsupported warnings: ${draft.unsupported.length}

## Extracted Fields

- Dates: ${fields.dates.join(", ") || "not found"}
- Amounts: ${fields.amounts.join(", ") || "not found"}
- Parties: ${fields.parties.join(", ") || "not found"}
- Addresses: ${fields.addresses.join(", ") || "not found"}
- Deadlines: ${fields.deadlines.join(", ") || "not found"}

## Generated Draft

${draft.content}
`;

await writeFile(join(sampleDir, "outputs", "expected_output_case_fact_summary.md"), draft.content);
await writeFile(join(sampleDir, "outputs", "evaluation-report.md"), report);
await writeFile(join(sampleDir, "outputs", "model-confidence-results.csv"), csv);

console.log(JSON.stringify({
  sample: manifest.name,
  qualityBand: quality.band,
  averageConfidence: quality.averageConfidence,
  pages: document.pages.length,
  citations: draft.citations.length,
  generated: `${sampleDir}/outputs/expected_output_case_fact_summary.md`,
  results: `${sampleDir}/outputs/model-confidence-results.csv`
}, null, 2));
