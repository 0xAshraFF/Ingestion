import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize, resolve } from "node:path";
import { ingestDocument, extractStructuredFields } from "./lib/intake.js";
import { chunkDocument } from "./lib/retrieval.js";
import { generateDraft } from "./lib/drafts.js";
import { captureEdit } from "./lib/editLearning.js";
import { providerSettings, runPaidFallback } from "./lib/providers.js";
import { addLesson, getStore, loadStore, upsertDocument } from "./lib/store.js";
import { aggregateQuality } from "./lib/quality.js";
import { buildDocumentResult, buildResultZip } from "./lib/exportBundle.js";
import { spawn } from "node:child_process";

const root = resolve(".");
const publicDir = resolve("public");
const port = Number(process.env.PORT || 3000);
const host = process.env.HOST || "127.0.0.1";

await loadStore();

const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url, `http://${request.headers.host}`);
    if (url.pathname.startsWith("/api/")) {
      await routeApi(request, response, url);
      return;
    }
    await serveStatic(response, url.pathname);
  } catch (error) {
    sendJson(response, error.statusCode || 500, { error: error.message || "Internal server error" });
  }
});

server.listen(port, host, () => {
  const url = `http://${host}:${port}`;
  console.log(`Local-first ingestion app running at ${url}`);
  if (process.argv.includes("--open")) {
    openBrowser(url);
  }
});

async function routeApi(request, response, url) {
  const parts = url.pathname.split("/").filter(Boolean);

  if (request.method === "GET" && url.pathname === "/api/health") {
    sendJson(response, 200, { ok: true });
    return;
  }

  if (request.method === "GET" && url.pathname === "/api/settings/providers") {
    sendJson(response, 200, providerSettings());
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/documents/upload") {
    const body = await readJson(request);
    const document = ingestDocument(body);
    const chunks = chunkDocument(document);
    await upsertDocument(document, chunks);
    sendJson(response, 201, {
      document,
      fields: extractStructuredFields(document),
      chunks,
      result: buildDocumentResult({ document, chunks })
    });
    return;
  }

  if (parts[1] === "documents" && parts[2]) {
    await routeDocumentApi(request, response, parts);
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/drafts") {
    const body = await readJson(request);
    const document = requireDocument(body.documentId);
    const chunks = getStore().chunks[document.id] || [];
    const draft = generateDraft({ document, chunks, type: body.type, lessons: getStore().lessons });
    await upsertDocument(document, chunks);
    sendJson(response, 201, {
      draft,
      result: buildDocumentResult({ document, chunks })
    });
    return;
  }

  if (parts[1] === "drafts" && parts[2]) {
    await routeDraftApi(request, response, parts);
    return;
  }

  sendJson(response, 404, { error: "Not found" });
}

async function routeDocumentApi(request, response, parts) {
  const document = requireDocument(parts[2]);
  const action = parts[3];

  if (request.method === "GET" && action === "status") {
    sendJson(response, 200, {
      id: document.id,
      title: document.title,
      pageCount: document.pages.length,
      status: document.pages.some((page) => page.status === "local_low_confidence") ? "needs_review" : "ready"
    });
    return;
  }

  if (request.method === "GET" && action === "extractions") {
    sendJson(response, 200, { fields: extractStructuredFields(document), pages: document.pages });
    return;
  }

  if (request.method === "GET" && action === "quality") {
    const metrics = document.pages.map((page) => page.metric);
    const drafts = document.drafts || [];
    const latestDraft = drafts.at(-1);
    sendJson(response, 200, {
      ...aggregateQuality(metrics),
      pages: document.pages.map((page) => ({ id: page.id, sourceFile: page.sourceFile, page: page.page, ...page.metric })),
      unsupportedClaimCount: latestDraft?.unsupported?.length || 0,
      citationCoverage: latestDraft?.citations?.length ? 1 : 0,
      editDelta: document.edits?.length || 0
    });
    return;
  }

  if (request.method === "GET" && action === "result") {
    sendJson(response, 200, buildDocumentResult({
      document,
      chunks: getStore().chunks[document.id] || []
    }));
    return;
  }

  if (request.method === "GET" && action === "export.zip") {
    const zip = buildResultZip(buildDocumentResult({
      document,
      chunks: getStore().chunks[document.id] || []
    }));
    response.writeHead(200, {
      "content-type": "application/zip",
      "content-disposition": `attachment; filename="${safeFilename(document.title || document.id)}-results.zip"`,
      "content-length": zip.length
    });
    response.end(zip);
    return;
  }

  if (request.method === "POST" && action === "fallback") {
    const body = await readJson(request);
    const targetIds = new Set(body.pageIds || document.pages.filter((page) => page.status === "local_low_confidence").map((page) => page.id));
    document.pages = document.pages.map((page) => targetIds.has(page.id)
      ? runPaidFallback({ page, providerName: body.provider })
      : page);
    const chunks = chunkDocument(document);
    await upsertDocument(document, chunks);
    sendJson(response, 200, { document, chunks });
    return;
  }

  sendJson(response, 404, { error: "Document endpoint not found" });
}

async function routeDraftApi(request, response, parts) {
  const draftId = parts[2];
  const document = Object.values(getStore().documents).find((candidate) =>
    candidate.drafts?.some((draft) => draft.id === draftId)
  );
  if (!document) throw notFound("Draft not found");

  const draft = document.drafts.find((item) => item.id === draftId);

  if (request.method === "GET" && parts.length === 3) {
    sendJson(response, 200, draft);
    return;
  }

  if (request.method === "PATCH" && parts.length === 3) {
    const body = await readJson(request);
    draft.content = String(body.content || draft.content);
    await upsertDocument(document, getStore().chunks[document.id] || []);
    sendJson(response, 200, draft);
    return;
  }

  if (request.method === "POST" && parts[3] === "edits") {
    const body = await readJson(request);
    const event = captureEdit({ document, draftId, before: body.before, after: body.after });
    await addLesson({ draftId, reusableLesson: event.reusableLesson, editType: event.editType });
    await upsertDocument(document, getStore().chunks[document.id] || []);
    sendJson(response, 201, event);
    return;
  }

  sendJson(response, 404, { error: "Draft endpoint not found" });
}

async function serveStatic(response, pathname) {
  const safePath = pathname === "/" ? "/index.html" : pathname;
  const filePath = normalize(join(publicDir, safePath));
  if (!filePath.startsWith(publicDir)) throw notFound("File not found");

  try {
    const content = await readFile(filePath);
    response.writeHead(200, { "content-type": mimeType(filePath) });
    response.end(content);
  } catch {
    const fallback = await readFile(join(publicDir, "index.html"));
    response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    response.end(fallback);
  }
}

async function readJson(request) {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  if (chunks.length === 0) return {};
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, { "content-type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(payload, null, 2));
}

function safeFilename(value) {
  return String(value).toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80) || "document";
}

function openBrowser(url) {
  const command = process.platform === "darwin"
    ? "open"
    : process.platform === "win32"
      ? "cmd"
      : "xdg-open";
  const args = process.platform === "win32" ? ["/c", "start", "", url] : [url];
  const child = spawn(command, args, { detached: true, stdio: "ignore" });
  child.on("error", () => {});
  child.unref();
}

function requireDocument(id) {
  const document = getStore().documents[id];
  if (!document) throw notFound("Document not found");
  return document;
}

function notFound(message) {
  const error = new Error(message);
  error.statusCode = 404;
  return error;
}

function mimeType(filePath) {
  const extension = extname(filePath);
  return {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".svg": "image/svg+xml"
  }[extension] || "application/octet-stream";
}
