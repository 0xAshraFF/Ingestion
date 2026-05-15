const state = {
  document: null,
  fields: null,
  draft: null
};

const elements = {
  uploadForm: document.querySelector("#upload-form"),
  fileInput: document.querySelector("#file-input"),
  fileList: document.querySelector("#file-list"),
  statusPill: document.querySelector("#status-pill"),
  qualityGrid: document.querySelector("#quality-grid"),
  pageQuality: document.querySelector("#page-quality"),
  fieldPanel: document.querySelector("#field-panel"),
  pageText: document.querySelector("#page-text"),
  fallbackButton: document.querySelector("#fallback-button"),
  draftType: document.querySelector("#draft-type"),
  draftButton: document.querySelector("#draft-button"),
  draftOutput: document.querySelector("#draft-output"),
  editBefore: document.querySelector("#edit-before"),
  editAfter: document.querySelector("#edit-after"),
  editButton: document.querySelector("#edit-button"),
  editLog: document.querySelector("#edit-log"),
  providerPanel: document.querySelector("#provider-panel")
};

elements.fileInput.addEventListener("change", () => {
  const files = [...elements.fileInput.files];
  elements.fileList.textContent = files.length ? files.map((file) => file.name).join(", ") : "No files selected";
});

elements.uploadForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const files = [...elements.fileInput.files];
  if (files.length === 0) return;

  setStatus("Reading files locally");
  const payloadFiles = await Promise.all(files.map(readBrowserFile));
  const result = await api("/api/documents/upload", { method: "POST", body: { files: payloadFiles } });

  state.document = result.document;
  state.fields = result.fields;
  state.draft = null;

  setStatus("Local intake complete");
  elements.draftButton.disabled = false;
  elements.fallbackButton.disabled = !state.document.pages.some((page) => page.status === "local_low_confidence");
  renderDocument(result.document, result.fields);
  await renderQuality();
});

elements.fallbackButton.addEventListener("click", async () => {
  if (!state.document) return;
  setStatus("Requesting BYOK fallback");
  try {
    const result = await api(`/api/documents/${state.document.id}/fallback`, {
      method: "POST",
      body: { provider: "gemini_byok" }
    });
    state.document = result.document;
    elements.fallbackButton.disabled = true;
    setStatus("Fallback complete");
    renderDocument(state.document, state.fields);
    await renderQuality();
  } catch (error) {
    setStatus(error.message);
  }
});

elements.draftButton.addEventListener("click", async () => {
  if (!state.document) return;
  setStatus("Generating grounded draft");
  const draft = await api("/api/drafts", {
    method: "POST",
    body: { documentId: state.document.id, type: elements.draftType.value }
  });
  state.draft = draft;
  elements.draftOutput.value = draft.content;
  elements.editButton.disabled = false;
  setStatus("Draft ready");
  await renderQuality();
});

elements.editButton.addEventListener("click", async () => {
  if (!state.draft) return;
  const before = elements.editBefore.value.trim();
  const after = elements.editAfter.value.trim();
  if (!before || !after) return;

  const event = await api(`/api/drafts/${state.draft.id}/edits`, {
    method: "POST",
    body: { before, after }
  });
  elements.editLog.textContent = `Captured ${event.editType} lesson: ${event.reusableLesson}`;
  elements.editBefore.value = "";
  elements.editAfter.value = "";
  await renderQuality();
});

renderProviders();

async function renderQuality() {
  if (!state.document) {
    elements.qualityGrid.innerHTML = "";
    elements.pageQuality.innerHTML = "";
    return;
  }

  const quality = await api(`/api/documents/${state.document.id}/quality`);
  elements.qualityGrid.innerHTML = [
    metric("Overall band", quality.band, `quality-${quality.band}`),
    metric("Average confidence", `${quality.averageConfidence}%`),
    metric("Fallback pages", quality.fallbackPageCount || 0),
    metric("Citation coverage", quality.citationCoverage ? "Ready" : "Pending"),
    metric("Unsupported claims", quality.unsupportedClaimCount || 0),
    metric("Edit lessons", quality.editDelta || 0)
  ].join("");

  elements.pageQuality.innerHTML = `
    <table>
      <thead>
        <tr>
          <th>File</th>
          <th>Page</th>
          <th>Band</th>
          <th>OCR</th>
          <th>Coverage</th>
          <th>Fallback</th>
        </tr>
      </thead>
      <tbody>
        ${quality.pages.map((page) => `
          <tr>
            <td>${escapeHtml(page.sourceFile)}</td>
            <td>${page.page}</td>
            <td class="quality-${page.qualityBand}">${page.qualityBand}</td>
            <td>${page.ocrConfidence}%</td>
            <td>${Math.round(page.pageCoverage * 100)}%</td>
            <td>${page.fallbackUsed ? page.provider || "yes" : "no"}</td>
          </tr>
        `).join("")}
      </tbody>
    </table>`;
}

function renderDocument(documentData, fields) {
  const fieldRows = Object.entries(fields).map(([key, value]) => {
    const text = Array.isArray(value) ? value.join(", ") || "Not found" : value || "Not found";
    return `<div class="field-item"><span>${labelFor(key)}</span><strong>${escapeHtml(text)}</strong></div>`;
  });
  elements.fieldPanel.innerHTML = fieldRows.join("");
  elements.pageText.textContent = documentData.pages
    .map((page) => `${page.sourceFile} page ${page.page}\n${page.text}`)
    .join("\n\n");
}

async function renderProviders() {
  const settings = await api("/api/settings/providers");
  elements.providerPanel.innerHTML = settings.providers.map((provider) => `
    <div class="provider">
      <span>${provider.name}</span>
      <strong>${provider.configured}</strong>
      <p class="notice">${provider.model}</p>
    </div>
  `).join("");
}

function metric(label, value, className = "") {
  return `<div class="metric"><span>${label}</span><strong class="${className}">${escapeHtml(String(value))}</strong></div>`;
}

async function readBrowserFile(file) {
  const text = await file.text().catch(() => "");
  return {
    name: file.name,
    type: file.type,
    size: file.size,
    text
  };
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    method: options.method || "GET",
    headers: { "content-type": "application/json" },
    body: options.body ? JSON.stringify(options.body) : undefined
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error || "Request failed");
  return payload;
}

function setStatus(value) {
  elements.statusPill.textContent = value;
}

function labelFor(key) {
  return key.replace(/([A-Z])/g, " $1").replace(/^./, (letter) => letter.toUpperCase());
}

function escapeHtml(value) {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  })[character]);
}
