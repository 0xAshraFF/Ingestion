import { randomUUID } from "node:crypto";
import { calculateQuality, needsFallback } from "./quality.js";
import { lookupSampleTranscript } from "./sampleTranscripts.js";
import { applyProfile } from "./schemaProfiles.js";

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
    const ocrUnavailable = isImageWithoutText(file, sourceType);

    if (ocrUnavailable) {
      pages.push({
        id: randomUUID(),
        documentId,
        sourceFile: file.name,
        page: 1,
        sourceType,
        text: "",
        status: "ocr_unavailable",
        metric: {
          ocrConfidence: 0,
          wordCount: 0,
          lowConfidenceWordCount: 0,
          pageCoverage: 0,
          fieldCompleteness: 0,
          fallbackUsed: false,
          qualityBand: "red",
          ocrAvailable: false
        }
      });
      continue;
    }

    const usedCuratedTranscript = sourceType === "image" && Boolean(lookupSampleTranscript(file.name));
    const pageTexts = normalizeToPages(file, sourceType);

    pageTexts.forEach((text, index) => {
      const pageNumber = index + 1;
      const metric = calculateQuality({ text, sourceType, hints: [file.name, file.type] });
      if (usedCuratedTranscript) {
        metric.provider = "curated_transcript";
      } else if (file.ocrProvider) {
        metric.provider = file.ocrProvider;
      }
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

export function extractStructuredFields(document, profileId = "auto") {
  const { profile, fields } = applyProfile(document, profileId);
  return { profile, ...fields };
}

function isImageWithoutText(file, sourceType) {
  if (sourceType !== "image") return false;
  if (file.ocrText && String(file.ocrText).trim().length > 8) return false;
  if (lookupSampleTranscript(file.name)) return false;
  return true;
}

function normalizeToPages(file, sourceType) {
  const sampleTranscript = sourceType === "image" ? lookupSampleTranscript(file.name) : null;

  if (sampleTranscript && sampleTranscript.trim().length > 20) {
    return splitTextPages(sampleTranscript);
  }

  const raw = String(file.ocrText || file.text || "");
  if (file.ocrText && raw.trim().length > 20) {
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

function extensionFor(name = "") {
  const last = name.toLowerCase().split(".").pop();
  return last === name ? "" : last;
}

function formatBytes(bytes) {
  return `${Math.round(bytes / 1024 / 1024)} MB`;
}
