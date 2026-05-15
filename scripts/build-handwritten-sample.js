import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { ingestDocument } from "../src/lib/intake.js";
import { chunkDocument } from "../src/lib/retrieval.js";
import { generateDraft } from "../src/lib/drafts.js";
import { aggregateQuality } from "../src/lib/quality.js";

const inputDir = "inputs/handwritten-analytical-positivism";
const resultDir = "results/handwritten-analytical-positivism";
await mkdir(resultDir, { recursive: true });
const manifest = JSON.parse(await readFile(join(inputDir, "manifest.json"), "utf8"));

const files = await Promise.all(manifest.pages.map(async (page) => {
  const transcript = await readFile(join(inputDir, page.transcript), "utf8");
  return {
    name: page.image,
    type: "image/jpeg",
    size: transcript.length,
    ocrText: transcript
  };
}));

const document = ingestDocument({ files });
const chunks = chunkDocument(document);
const draft = generateDraft({
  document,
  chunks,
  type: manifest.draftType,
  lessons: [
    {
      reusableLesson: "For study notes, group the draft by jurist and concept, then call out unclear handwriting separately."
    }
  ]
});
const quality = aggregateQuality(document.pages.map((page) => page.metric));

const report = `# Handwritten Sample Build Report

Sample: ${manifest.name}

## Input Files

${manifest.pages.map((page) => `- Page ${page.page}: ${page.image} - ${page.topic}`).join("\n")}

## Quality Result

- Overall quality band: ${quality.band}
- Average OCR confidence: ${quality.averageConfidence}%
- Pages processed: ${document.pages.length}
- Citations generated: ${draft.citations.length}
- Unsupported warnings: ${draft.unsupported.length}

## Generated Draft

${draft.content}
`;

await writeFile(join(resultDir, "actual-study-note-summary.md"), draft.content);
await writeFile(join(resultDir, "evaluation-report.md"), report);

console.log(JSON.stringify({
  run: manifest.name,
  qualityBand: quality.band,
  averageConfidence: quality.averageConfidence,
  pages: document.pages.length,
  citations: draft.citations.length,
  generated: `${resultDir}/actual-study-note-summary.md`,
  report: `${resultDir}/evaluation-report.md`
}, null, 2));
