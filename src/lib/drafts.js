import { randomUUID } from "node:crypto";
import { citationFor, retrieveEvidence } from "./retrieval.js";
import { aggregateQuality } from "./quality.js";

export const DRAFT_TYPES = [
  "Review summary",
  "Study note summary",
  "Case fact summary",
  "Notice-related summary",
  "Document checklist",
  "First-pass internal memo"
];

export function generateDraft({ document, chunks, type = "Case fact summary", lessons = [] }) {
  if (!DRAFT_TYPES.includes(type)) {
    throw new Error(`Unsupported draft type: ${type}`);
  }

  const query = queryForType(type, document);
  const evidence = retrieveEvidence(chunks, query, 8);
  const metrics = document.pages.map((page) => page.metric);
  const quality = aggregateQuality(metrics);
  const citations = evidence.map(citationFor);
  const unsupported = [];

  if (evidence.length === 0) {
    unsupported.push("No retrieved evidence matched the selected draft type.");
  }
  if (quality.band !== "green") {
    unsupported.push(`Extraction quality is ${quality.band}; reviewer confirmation is required before relying on this draft.`);
  }

  const draft = {
    id: randomUUID(),
    documentId: document.id,
    type,
    createdAt: new Date().toISOString(),
    citations,
    unsupported,
    content: type === "Study note summary"
      ? renderStudyNoteDraft({ chunks, quality, unsupported, lessons })
      : renderDraft({ document, type, evidence, quality, unsupported, lessons })
  };

  document.drafts.push(draft);
  return draft;
}

function renderDraft({ document, type, evidence, quality, unsupported, lessons }) {
  const knownFacts = evidence.length
    ? evidence.slice(0, 5).map((item, index) => `${index + 1}. ${summarize(item.text)} [${item.sourceFile} p.${item.page}]`).join("\n")
    : "No grounded facts were found from retrieval.";

  const sourceEvidence = evidence.length
    ? evidence.slice(0, 6).map((item) => `- ${item.sourceFile} page ${item.page}: "${item.text.slice(0, 160)}"`).join("\n")
    : "- No source evidence available.";

  const lessonText = lessons.length
    ? `\nApplied reviewer preferences:\n${lessons.slice(-3).map((lesson) => `- ${lesson.reusableLesson}`).join("\n")}\n`
    : "";

  return `# ${type}

Reviewer warning: Quality band is ${quality.band} with average OCR confidence ${quality.averageConfidence}%.

## Known facts
${knownFacts}

## Potential issues
- Confirm red or amber OCR pages before using the draft externally.
- Verify every amount, date, party name, and deadline against source evidence.

## Missing information
${unsupported.length ? unsupported.map((item) => `- ${item}`).join("\n") : "- No unsupported claims were detected in this template draft."}

## Source evidence
${sourceEvidence}
${lessonText}`.trim();
}

function renderStudyNoteDraft({ chunks, quality, unsupported, lessons }) {
  const groups = [
    {
      title: "Analytical Positivism",
      terms: ["analytical", "positivism", "positivist"],
      fallback: "The notes frame analytical positivism around identifying what law is rather than what law ought to be."
    },
    {
      title: "John Austin",
      terms: ["austin", "command", "positive law", "positive morality", "sanction"],
      fallback: "The notes connect Austin with command theory, positive law, positive morality, and sanctions."
    },
    {
      title: "Jeremy Bentham",
      terms: ["bentham", "utilitarianism", "pleasure", "hedonism", "felicific"],
      fallback: "The notes connect Bentham with utilitarianism, hedonism, and the felicific calculus."
    },
    {
      title: "H. L. A. Hart",
      terms: ["hart", "primary rules", "secondary rules", "concept of law"],
      fallback: "The notes show Hart criticizing Austin's command theory and distinguishing primary and secondary rules."
    },
    {
      title: "Hans Kelsen",
      terms: ["kelsen", "pure theory", "grundnorm", "norms", "directions"],
      fallback: "The notes describe Kelsen's Pure Theory of Law as a system of norms or directions connected to a grundnorm."
    }
  ];

  const conceptSections = groups.map((group) => {
    const facts = findRelevantFacts(chunks, group.terms).slice(0, 3);
    const lines = facts.length
      ? facts.map((fact) => `- ${fact.text} [${fact.sourceFile} p.${fact.page}]`)
      : [`- ${group.fallback}`];
    return `## ${group.title}\n${lines.join("\n")}`;
  }).join("\n\n");

  const evidence = chunks
    .filter((chunk) => chunk.text.trim() && !chunk.text.trim().startsWith("#"))
    .slice(0, 6)
    .map((chunk) => `- ${chunk.sourceFile} page ${chunk.page}: "${chunk.text.replace(/\s+/g, " ").slice(0, 150)}"`)
    .join("\n");

  const lessonText = lessons.length
    ? `\nApplied reviewer preferences:\n${lessons.slice(-3).map((lesson) => `- ${lesson.reusableLesson}`).join("\n")}\n`
    : "";

  return `# Study note summary

Reviewer warning: Quality band is ${quality.band} with average OCR confidence ${quality.averageConfidence}%. These handwritten pages require human review or vision fallback before high-stakes use.

${conceptSections}

## Potential issues
- Some handwriting is partially unclear, especially near page edges and overlapping notebook margins.
- Page order should be verified because some photos include parts of adjacent pages.
- Personal identifying text visible in the source image should remain redacted in public outputs.

## Missing information
${unsupported.length ? unsupported.map((item) => `- ${item}`).join("\n") : "- Full bibliographic references are not included in the notes."}

## Source evidence
${evidence || "- No source evidence available."}
${lessonText}`.trim();
}

function findRelevantFacts(chunks, terms) {
  const facts = [];
  for (const chunk of chunks) {
    for (const sentence of splitFacts(chunk.text)) {
      const lower = sentence.toLowerCase();
      if (terms.some((term) => lower.includes(term))) {
        facts.push({ ...chunk, text: sentence });
      }
    }
  }
  return facts;
}

function splitFacts(text) {
  return text
    .split(/\n+|(?<=[.!?])\s+/)
    .map((line) => line.replace(/^[-*#\d.\s]+/, "").trim())
    .filter((line) => line.length > 35 && !line.startsWith("Page "));
}

function queryForType(type, document) {
  const base = document.title;
  if (type === "Notice-related summary") return `${base} notice deadline due landlord tenant`;
  if (type === "Study note summary") return `${base} analytical positivism Austin Bentham Hart Kelsen jurisprudence law rules`;
  if (type === "Document checklist") return `${base} date amount address party signature exhibit attachment`;
  if (type === "First-pass internal memo") return `${base} facts issues timeline evidence`;
  if (type === "Review summary") return `${base} summary facts dates parties`;
  return `${base} case facts chronology parties dates amount rent tenant landlord debt collector summons response payment notice`;
}

function summarize(text) {
  const clean = text.replace(/\s+/g, " ").trim();
  return clean.length > 180 ? `${clean.slice(0, 177)}...` : clean;
}
