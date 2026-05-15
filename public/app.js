const state = {
  document: null,
  fields: null,
  draft: null,
  result: null,
  selectedFiles: []
};

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;
const ALLOWED_EXTENSIONS = new Set(["pdf", "png", "jpg", "jpeg", "tif", "tiff", "docx", "txt", "md"]);

const elements = {
  uploadForm: document.querySelector("#upload-form"),
  fileInput: document.querySelector("#file-input"),
  fileList: document.querySelector("#file-list"),
  chooseButton: document.querySelector("#choose-button"),
  uploadButton: document.querySelector("#upload-button"),
  validationPanel: document.querySelector("#validation-panel"),
  loader: document.querySelector("#loader"),
  statusPill: document.querySelector("#status-pill"),
  qualityGrid: document.querySelector("#quality-grid"),
  pageQuality: document.querySelector("#page-quality"),
  fieldPanel: document.querySelector("#field-panel"),
  pageText: document.querySelector("#page-text"),
  fallbackButton: document.querySelector("#fallback-button"),
  draftType: document.querySelector("#draft-type"),
  draftButton: document.querySelector("#draft-button"),
  downloadButton: document.querySelector("#download-button"),
  draftOutput: document.querySelector("#draft-output"),
  editBefore: document.querySelector("#edit-before"),
  editAfter: document.querySelector("#edit-after"),
  editButton: document.querySelector("#edit-button"),
  editLog: document.querySelector("#edit-log"),
  providerPanel: document.querySelector("#provider-panel"),
  jsonOutput: document.querySelector("#json-output"),
  artifactPanel: document.querySelector("#artifact-panel"),
  toast: document.querySelector("#toast")
};

elements.chooseButton.addEventListener("click", () => elements.fileInput.click());

elements.fileInput.addEventListener("change", () => {
  setSelectedFiles([...elements.fileInput.files]);
});

const dropZone = document.querySelector(".drop-zone");
dropZone.addEventListener("dragover", (event) => {
  event.preventDefault();
  dropZone.classList.add("is-dragging");
});
dropZone.addEventListener("dragleave", () => dropZone.classList.remove("is-dragging"));
dropZone.addEventListener("drop", (event) => {
  event.preventDefault();
  dropZone.classList.remove("is-dragging");
  setSelectedFiles([...event.dataTransfer.files]);
});

elements.uploadForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const files = state.selectedFiles;
  const errors = validateFiles(files);
  renderValidation(errors);
  if (errors.length > 0) {
    notify("Fix upload validation errors before running ingestion.", "error");
    return;
  }

  setLoading(true, "Reading files locally");
  try {
    const payloadFiles = await Promise.all(files.map(readBrowserFile));
    const result = await api("/api/documents/upload", { method: "POST", body: { files: payloadFiles } });

    state.document = result.document;
    state.fields = result.fields;
    state.draft = null;
    state.result = result.result;

    setStatus("Local intake complete");
    notify("Upload finished. Extraction and quality metrics are ready.", "success");
    elements.draftButton.disabled = false;
    elements.downloadButton.disabled = false;
    elements.fallbackButton.disabled = !state.document.pages.some((page) => page.status === "local_low_confidence");
    renderDocument(result.document, result.fields);
    renderResult(result.result);
    await renderQuality();
  } catch (error) {
    notify(error.message, "error");
    setStatus("Upload failed");
  } finally {
    setLoading(false);
  }
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
    notify("Fallback completed and metrics were refreshed.", "success");
    renderDocument(state.document, state.fields);
    await refreshResult();
  } catch (error) {
    setStatus(error.message);
    notify(error.message, "error");
  }
});

elements.draftButton.addEventListener("click", async () => {
  if (!state.document) return;
  setLoading(true, "Generating grounded draft");
  try {
    const payload = await api("/api/drafts", {
      method: "POST",
      body: { documentId: state.document.id, type: elements.draftType.value }
    });
    state.draft = payload.draft;
    state.result = payload.result;
    elements.draftOutput.value = payload.draft.content;
    elements.editButton.disabled = false;
    elements.downloadButton.disabled = false;
    renderResult(payload.result);
    setStatus("Draft ready");
    notify("Draft generated. JSON, metrics, and ZIP export are ready.", "success");
    await renderQuality();
  } catch (error) {
    notify(error.message, "error");
  } finally {
    setLoading(false);
  }
});

elements.downloadButton.addEventListener("click", () => {
  if (!state.document) return;
  window.location.href = `/api/documents/${state.document.id}/export.zip`;
  notify("ZIP export started.", "success");
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
  notify("Reviewer edit lesson captured.", "success");
  await refreshResult();
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

async function refreshResult() {
  if (!state.document) return;
  state.result = await api(`/api/documents/${state.document.id}/result`);
  renderResult(state.result);
  await renderQuality();
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

function renderResult(result) {
  if (!result) {
    elements.jsonOutput.textContent = "{}";
    return;
  }
  elements.jsonOutput.textContent = JSON.stringify(result, null, 2);
  elements.artifactPanel.innerHTML = `
    <div class="field-item"><span>JSON</span><strong>result.json</strong></div>
    <div class="field-item"><span>Markdown</span><strong>result.md</strong></div>
    <div class="field-item"><span>Metrics</span><strong>metrics.csv</strong></div>
    <div class="field-item"><span>Draft</span><strong>draft.md</strong></div>
  `;
}

function setSelectedFiles(files) {
  state.selectedFiles = files;
  elements.fileList.textContent = files.length
    ? files.map((file) => `${file.name} (${formatBytes(file.size)})`).join(", ")
    : "PDF, image, DOCX, TXT, or MD. Max 10 MB per file.";
  renderValidation(validateFiles(files));
}

function validateFiles(files) {
  const errors = [];
  if (files.length === 0) {
    errors.push("Choose at least one file.");
  }
  for (const file of files) {
    const extension = file.name.toLowerCase().split(".").pop();
    if (!ALLOWED_EXTENSIONS.has(extension)) {
      errors.push(`${file.name}: unsupported file type.`);
    }
    if (file.size > MAX_FILE_SIZE_BYTES) {
      errors.push(`${file.name}: exceeds 10 MB.`);
    }
  }
  return errors;
}

function renderValidation(errors) {
  elements.validationPanel.innerHTML = errors.length
    ? errors.map((error) => `<div>${escapeHtml(error)}</div>`).join("")
    : state.selectedFiles.length
      ? "<div>Validation passed.</div>"
      : "";
}

function setLoading(isLoading, message = "Processing") {
  elements.loader.classList.toggle("hidden", !isLoading);
  elements.uploadButton.disabled = isLoading;
  elements.draftButton.disabled = isLoading || !state.document;
  elements.loader.querySelector("span:last-child").textContent = `${message}...`;
  if (isLoading) setStatus(message);
}

function notify(message, type = "success") {
  elements.toast.textContent = message;
  elements.toast.className = `toast ${type}`;
  window.setTimeout(() => {
    elements.toast.classList.add("hidden");
  }, 4200);
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

function formatBytes(bytes) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${Math.round((bytes / 1024 / 1024) * 10) / 10} MB`;
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
