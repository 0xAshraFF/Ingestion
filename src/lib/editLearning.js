import { randomUUID } from "node:crypto";

export function captureEdit({ document, draftId, before, after }) {
  if (!before || !after || before === after) {
    throw new Error("Edit capture requires distinct before and after text.");
  }

  const editType = classifyEdit(before, after);
  const event = {
    id: randomUUID(),
    documentId: document.id,
    draftId,
    before,
    after,
    editType,
    accepted: true,
    reusableLesson: lessonFor(editType),
    createdAt: new Date().toISOString()
  };

  document.edits.push(event);
  return event;
}

export function classifyEdit(before, after) {
  if (/chronolog|timeline|first|then|next|finally/i.test(after)) return "format";
  if (after.length > before.length * 1.35) return "missing_fact";
  if (after.length < before.length * 0.7) return "clarity";
  if (/\[[^\]]+\sp\.\d+\]/.test(after) && !/\[[^\]]+\sp\.\d+\]/.test(before)) return "citation";
  if (/may|could|appears|uncertain|review/i.test(after)) return "tone";
  return "clarity";
}

function lessonFor(editType) {
  const lessons = {
    tone: "Use careful uncertainty language when evidence is incomplete.",
    missing_fact: "Include material facts added by the reviewer in later drafts when evidence supports them.",
    incorrect_fact: "Prefer source wording over inferred facts.",
    format: "Prefer chronological ordering in case fact summaries.",
    citation: "Attach page-level citations to factual claims.",
    clarity: "Keep draft sentences concise and reviewer-ready."
  };
  return lessons[editType] || lessons.clarity;
}
