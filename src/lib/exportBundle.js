import { aggregateQuality } from "./quality.js";
import { extractStructuredFields } from "./intake.js";

const CRC_TABLE = makeCrcTable();

export function buildDocumentResult({ document, chunks = [], profileId = "auto" }) {
  const metrics = document.pages.map((page) => page.metric);
  const latestDraft = document.drafts?.at(-1) || null;
  const quality = {
    ...aggregateQuality(metrics),
    pages: document.pages.map((page) => ({
      id: page.id,
      sourceFile: page.sourceFile,
      page: page.page,
      provider: page.metric.provider || "local",
      modelUsed: page.metric.provider || modelForSource(page.sourceType),
      ...page.metric
    })),
    unsupportedClaimCount: latestDraft?.unsupported?.length || 0,
    citationCoverage: latestDraft?.citations?.length ? 1 : 0,
    editDelta: document.edits?.length || 0
  };

  return {
    document,
    fields: extractStructuredFields(document, profileId),
    quality,
    chunks,
    latestDraft
  };
}

export function metricsCsv(result) {
  const rows = [
    "input_doc,page,model_used,confidence_metric,quality_band,fallback_used,coverage,word_count"
  ];
  for (const page of result.quality.pages) {
    rows.push([
      csvCell(page.sourceFile),
      page.page,
      page.modelUsed,
      `${page.ocrConfidence}%`,
      page.qualityBand,
      page.fallbackUsed ? "yes" : "no",
      `${Math.round(page.pageCoverage * 100)}%`,
      page.wordCount
    ].join(","));
  }
  return rows.join("\n");
}

export function resultMarkdown(result) {
  const draft = result.latestDraft?.content || "No draft has been generated yet.";
  return `# Document Result

## Metrics

| input doc | page | model used | confidence | quality | fallback |
|---|---:|---|---:|---|---|
${result.quality.pages.map((page) => `| ${page.sourceFile} | ${page.page} | ${page.modelUsed} | ${page.ocrConfidence}% | ${page.qualityBand} | ${page.fallbackUsed ? "yes" : "no"} |`).join("\n")}

## Structured Fields

\`\`\`json
${JSON.stringify(result.fields, null, 2)}
\`\`\`

## Draft

${draft}
`;
}

export function buildResultZip(result) {
  const files = [
    ["result.json", JSON.stringify(result, null, 2)],
    ["metrics.csv", metricsCsv(result)],
    ["result.md", resultMarkdown(result)],
    ["draft.md", result.latestDraft?.content || "No draft has been generated yet."],
    ["extracted_text.txt", plainTextDump(result.document)]
  ];
  return createZip(files);
}

export function plainTextDump(document) {
  if (!document?.pages?.length) return "";
  return document.pages
    .map((page) => {
      const body = page.status === "ocr_unavailable"
        ? "[Local OCR not installed — no extracted text for this image.]"
        : (page.text || "").trim() || "[No text extracted for this page.]";
      return `=== ${page.sourceFile} — page ${page.page} ===\n${body}`;
    })
    .join("\n\n");
}

function modelForSource(sourceType) {
  if (sourceType === "pdf") return "local_pdf_text_extractor";
  if (sourceType === "image") return "local_ocr_heuristic";
  if (sourceType === "docx") return "local_docx_text_extractor";
  return "local_text_extractor";
}

function createZip(files) {
  const localParts = [];
  const centralParts = [];
  let offset = 0;

  for (const [name, content] of files) {
    const nameBuffer = Buffer.from(name);
    const data = Buffer.from(content);
    const crc = crc32(data);

    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(20, 4);
    localHeader.writeUInt16LE(0, 6);
    localHeader.writeUInt16LE(0, 8);
    localHeader.writeUInt16LE(0, 10);
    localHeader.writeUInt16LE(0, 12);
    localHeader.writeUInt32LE(crc, 14);
    localHeader.writeUInt32LE(data.length, 18);
    localHeader.writeUInt32LE(data.length, 22);
    localHeader.writeUInt16LE(nameBuffer.length, 26);
    localHeader.writeUInt16LE(0, 28);

    localParts.push(localHeader, nameBuffer, data);

    const centralHeader = Buffer.alloc(46);
    centralHeader.writeUInt32LE(0x02014b50, 0);
    centralHeader.writeUInt16LE(20, 4);
    centralHeader.writeUInt16LE(20, 6);
    centralHeader.writeUInt16LE(0, 8);
    centralHeader.writeUInt16LE(0, 10);
    centralHeader.writeUInt16LE(0, 12);
    centralHeader.writeUInt16LE(0, 14);
    centralHeader.writeUInt32LE(crc, 16);
    centralHeader.writeUInt32LE(data.length, 20);
    centralHeader.writeUInt32LE(data.length, 24);
    centralHeader.writeUInt16LE(nameBuffer.length, 28);
    centralHeader.writeUInt16LE(0, 30);
    centralHeader.writeUInt16LE(0, 32);
    centralHeader.writeUInt16LE(0, 34);
    centralHeader.writeUInt16LE(0, 36);
    centralHeader.writeUInt32LE(0, 38);
    centralHeader.writeUInt32LE(offset, 42);
    centralParts.push(centralHeader, nameBuffer);

    offset += localHeader.length + nameBuffer.length + data.length;
  }

  const centralDirectory = Buffer.concat(centralParts);
  const localData = Buffer.concat(localParts);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(centralDirectory.length, 12);
  end.writeUInt32LE(localData.length, 16);
  end.writeUInt16LE(0, 20);

  return Buffer.concat([localData, centralDirectory, end]);
}

function csvCell(value) {
  const text = String(value ?? "");
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function crc32(buffer) {
  let crc = -1;
  for (const byte of buffer) {
    crc = (crc >>> 8) ^ CRC_TABLE[(crc ^ byte) & 0xff];
  }
  return (crc ^ -1) >>> 0;
}

function makeCrcTable() {
  const table = [];
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
}
