export function qualityBand({ ocrConfidence, pageCoverage }) {
  if (ocrConfidence >= 90 && pageCoverage >= 0.95) return "green";
  if (ocrConfidence >= 75 && pageCoverage >= 0.8) return "amber";
  return "red";
}

export function calculateQuality({ text, sourceType, hints = [] }) {
  const wordCount = countWords(text);
  const joinedHints = hints.join(" ").toLowerCase();
  const noisyHint = /noisy|scan|hand|blur|photo|screenshot|low|bad/.test(joinedHints);
  const textLike = sourceType === "txt" || sourceType === "md";

  let ocrConfidence = textLike ? 96 : 82;
  if (wordCount < 20) ocrConfidence -= 18;
  if (noisyHint) ocrConfidence -= 22;
  if (sourceType === "image") ocrConfidence -= 8;
  if (sourceType === "docx") ocrConfidence -= 12;
  if (sourceType === "pdf" && wordCount > 40) ocrConfidence += 5;

  ocrConfidence = clamp(Math.round(ocrConfidence * 10) / 10, 35, 99);
  const pageCoverage = textLike
    ? clamp(wordCount / 40, 0.9, 0.99)
    : sourceType === "pdf"
      ? clamp(wordCount / 80, 0.82, 0.96)
    : clamp(wordCount / 120, noisyHint ? 0.42 : 0.68, 0.94);
  const lowConfidenceWordCount = Math.round(wordCount * (1 - ocrConfidence / 100));
  const fieldCompleteness = clamp((wordCount > 60 ? 0.82 : 0.48) + (ocrConfidence - 75) / 100, 0.25, 0.98);

  return {
    ocrConfidence,
    wordCount,
    lowConfidenceWordCount,
    pageCoverage: Math.round(pageCoverage * 100) / 100,
    fieldCompleteness: Math.round(fieldCompleteness * 100) / 100,
    fallbackUsed: false,
    qualityBand: qualityBand({ ocrConfidence, pageCoverage })
  };
}

export function needsFallback(metric, requiredFieldMissing = false) {
  return (
    metric.ocrConfidence < 75 ||
    metric.pageCoverage < 0.8 ||
    requiredFieldMissing ||
    metric.fieldCompleteness < 0.6
  );
}

export function aggregateQuality(metrics) {
  if (metrics.length === 0) {
    return { band: "red", averageConfidence: 0, citationCoverage: 0, unsupportedClaimCount: 0 };
  }

  const scored = metrics.filter((metric) => metric.ocrAvailable !== false);
  const averageConfidence = scored.length
    ? scored.reduce((sum, metric) => sum + metric.ocrConfidence, 0) / scored.length
    : 0;
  const lowest = metrics.some((metric) => metric.qualityBand === "red")
    ? "red"
    : metrics.some((metric) => metric.qualityBand === "amber")
      ? "amber"
      : "green";

  return {
    band: lowest,
    averageConfidence: Math.round(averageConfidence * 10) / 10,
    fallbackPageCount: metrics.filter((metric) => metric.fallbackUsed).length,
    ocrUnavailableCount: metrics.filter((metric) => metric.ocrAvailable === false).length
  };
}

function countWords(text = "") {
  const matches = String(text).trim().match(/\b[\w'-]+\b/g);
  return matches ? matches.length : 0;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
