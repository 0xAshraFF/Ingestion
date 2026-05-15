import { randomUUID } from "node:crypto";

export function chunkDocument(document) {
  return document.pages.flatMap((page) => {
    const paragraphs = page.text.split(/\n{2,}/).map((part) => part.trim()).filter(Boolean);
    const sourceParts = paragraphs.length ? paragraphs : [page.text];

    return sourceParts.map((text) => ({
      id: randomUUID(),
      documentId: document.id,
      pageId: page.id,
      sourceFile: page.sourceFile,
      page: page.page,
      text,
      ocrConfidence: page.metric.ocrConfidence,
      qualityBand: page.metric.qualityBand
    }));
  });
}

export function retrieveEvidence(chunks, query, topK = 6) {
  const terms = tokenize(query);
  return chunks
    .map((chunk) => ({ chunk, score: scoreChunk(chunk, terms) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK)
    .map(({ chunk, score }) => ({ ...chunk, score: Math.round(score * 100) / 100 }));
}

export function citationFor(chunk) {
  return {
    source: chunk.sourceFile,
    page: chunk.page,
    quoteOrSpan: chunk.text.slice(0, 220),
    confidence: Math.round((chunk.ocrConfidence / 100) * 100) / 100
  };
}

function scoreChunk(chunk, terms) {
  const text = chunk.text.toLowerCase();
  const termScore = terms.reduce((score, term) => score + (text.includes(term) ? 1 : 0), 0);
  const qualityBoost = chunk.qualityBand === "green" ? 0.3 : chunk.qualityBand === "amber" ? 0.1 : 0;
  return termScore + qualityBoost;
}

function tokenize(value) {
  const terms = String(value).toLowerCase().match(/\b[a-z0-9]{3,}\b/g) || [];
  return [...new Set(terms)];
}
