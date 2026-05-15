import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const dataDir = resolve(process.env.DATA_DIR || "./data");
const storePath = resolve(dataDir, "store.json");

let state = {
  documents: {},
  chunks: {},
  lessons: []
};

export async function loadStore() {
  try {
    state = JSON.parse(await readFile(storePath, "utf8"));
  } catch {
    await saveStore();
  }
  return state;
}

export function getStore() {
  return state;
}

export async function saveStore() {
  await mkdir(dirname(storePath), { recursive: true });
  await writeFile(storePath, JSON.stringify(state, null, 2));
}

export async function upsertDocument(document, chunks = []) {
  state.documents[document.id] = document;
  state.chunks[document.id] = chunks;
  await saveStore();
}

export async function addLesson(lesson) {
  state.lessons.push(lesson);
  await saveStore();
}
