import { randomUUID } from "node:crypto";
import { calculateQuality, needsFallback } from "./quality.js";
import { lookupSampleTranscript } from "./sampleTranscripts.js";

const SUPPORTED_EXTENSIONS = new Set(["pdf", "png", "jpg", "jpeg", "tif", "tiff", "docx", "txt", "md"]);
const IMAGE_EXTENSIONS = new Set(["png", "jpg", "jpeg", "tif", "tiff"]);
export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;

export function validateFile(file) {
  const extension = extensionFor(file.name);
  if (!SUPPORTED_EXTENSIONS.has(extension)) {
    throw new Error(`Unsupported file type: ${file.name}`);
  }
  if ((file.size || 0) > MAX_FILE_SIZE_BYTES) {
    throw new Error(`File is too large: ${file.name}. Maximum size is ${formatBytes(MAX_FILE_SIZE_BYTES)}.`);
  }
  return extension;
}

export function ingestDocument({ files }) {
  if (!Array.isArray(files) || files.length === 0) {
    throw new Error("Upload at least one file.");
  }

  const documentId = randomUUID();
  const now = new Date().toISOString();
  const pages = [];

  for (const file of files) {
    const extension = validateFile(file);
    const sourceType = IMAGE_EXTENSIONS.has(extension) ? "image" : extension;
    const pageTexts = normalizeToPages(file, sourceType);

    pageTexts.forEach((text, index) => {
      const pageNumber = index + 1;
      const metric = calculateQuality({ text, sourceType, hints: [file.name, file.type] });
      pages.push({
        id: randomUUID(),
        documentId,
        sourceFile: file.name,
        page: pageNumber,
        sourceType,
        text,
        status: needsFallback(metric) ? "local_low_confidence" : "local_pass",
        metric
      });
    });
  }

  return {
    id: documentId,
    createdAt: now,
    title: files.map((file) => file.name).join(", "),
    files: files.map((file) => ({
      name: file.name,
      type: file.type || "application/octet-stream",
      size: file.size || 0
    })),
    pages,
    edits: [],
    drafts: []
  };
}

export function extractStructuredFields(document) {
  const allText = document.pages.map((page) => page.text).join("\n");
  return {
    title: inferTitle(document, allText),
    dates: uniqueMatches(allText, /\b(?:\d{4}-\d{2}-\d{2}|\d{1,2}\/\d{1,2}\/\d{2,4}|(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\.?\s+\d{1,2},?\s+\d{4})\b/gi),
    amounts: uniqueMatches(allText, /(?:USD\s*)?\$\s?\d[\d,]*(?:\.\d{2})?/gi),
    addresses: uniqueMatches(allText, /\b\d{1,6}[ \t]+[A-Za-z0-9 .'-]+(?:Street|St|Road|Rd|Avenue|Ave|Lane|Ln|Drive|Dr|Boulevard|Blvd)\b/gi),
    parties: inferParties(allText),
    deadlines: uniqueMatches(allText, /\b(?:deadline|due|respond by|before|no later than)\s+.{0,48}/gi)
  };
}

function normalizeToPages(file, sourceType) {
  const sampleTranscript = sourceType === "image" ? lookupSampleTranscript(file.name) : null;
  const raw = String(file.ocrText || sampleTranscript || file.text || "");
  if (file.ocrText && raw.trim().length > 20) {
    return splitTextPages(raw);
  }

  if (sampleTranscript && raw.trim().length > 20) {
    return splitTextPages(raw);
  }

  if (sourceType === "txt" || sourceType === "md") {
    return splitTextPages(raw || `No readable text was supplied for ${file.name}.`);
  }

  if (sourceType === "pdf" && raw.trim().length > 40) {
    return splitTextPages(cleanPdfText(raw));
  }

  const label = sourceType === "image" ? "Image" : sourceType.toUpperCase();
  return [
    `${label} file ${file.name} was received and normalized for local OCR. ` +
      "The browser demo cannot run native OCR without installing an OCR engine, so this page is flagged for review if confidence is low."
  ];
}

function splitTextPages(text) {
  const formFeedPages = text.split(/\f+/).map((page) => page.trim()).filter(Boolean);
  if (formFeedPages.length > 1) return formFeedPages;

  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length <= 450) return [text.trim()];

  const pages = [];
  for (let i = 0; i < words.length; i += 450) {
    pages.push(words.slice(i, i + 450).join(" "));
  }
  return pages;
}

function cleanPdfText(text) {
  return text.replace(/[^\S\r\n]+/g, " ").replace(/\0/g, "").trim();
}

function inferTitle(document, allText) {
  const firstLine = allText.split(/\n/).map((line) => line.trim()).find(Boolean);
  return firstLine?.slice(0, 90) || document.title;
}

function inferParties(text) {
  const labels = uniqueMatches(text, /\b(?:tenant|landlord|plaintiff|defendant|client|applicant|respondent|petitioner)\s*:\s*[A-Z][A-Za-z .'-]+/gi);
  const names = uniqueMatches(text, /\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,2}\b/g).slice(0, 8);
  return labels.length ? labels : names;
}

function uniqueMatches(text, pattern) {
  return [...new Set(String(text).match(pattern) || [])].map((value) => value.trim()).slice(0, 12);
}

function extensionFor(name = "") {
  const last = name.toLowerCase().split(".").pop();
  return last === name ? "" : last;
}

function formatBytes(bytes) {
  return `${Math.round(bytes / 1024 / 1024)} MB`;
}
