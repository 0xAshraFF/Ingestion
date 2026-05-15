import { mkdir, writeFile, unlink } from "node:fs/promises";
import { join, resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { spawn, spawnSync } from "node:child_process";

const IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/jpg", "image/tiff"]);

export function localOcrStatus() {
  const result = spawnSync("tesseract", ["--version"], { encoding: "utf8" });
  if (result.status === 0) {
    return {
      available: true,
      engine: "tesseract",
      version: firstLine(result.stdout),
      installCommand: null
    };
  }

  return {
    available: false,
    engine: "tesseract",
    version: null,
    installCommand: installCommand()
  };
}

export async function installLocalOcr() {
  if (localOcrStatus().available) {
    return localOcrStatus();
  }

  const command = installCommand();
  if (!command) {
    return {
      available: false,
      engine: "tesseract",
      error: "Automatic install is only configured for macOS with Homebrew. Install Tesseract manually and restart the app."
    };
  }

  const [bin, ...args] = command;
  const install = await runCommand(bin, args, 1000 * 60 * 8);
  const status = localOcrStatus();
  return {
    ...status,
    installerExitCode: install.code,
    installerOutput: install.output.slice(-3000)
  };
}

export async function applyLocalOcr(files = []) {
  const status = localOcrStatus();
  if (!status.available) return files;

  return Promise.all(files.map(async (file) => {
    if (!isImage(file) || !file.base64) return file;
    const text = await runTesseract(file);
    if (!text || text.trim().length < 8) return file;
    return {
      ...file,
      ocrText: text.trim(),
      ocrProvider: "local_tesseract_ocr"
    };
  }));
}

async function runTesseract(file) {
  const dir = resolve(process.env.DATA_DIR || "./data", "ocr");
  await mkdir(dir, { recursive: true });
  const extension = file.name?.toLowerCase().endsWith(".png") ? "png" : "jpg";
  const path = join(dir, `${randomUUID()}.${extension}`);
  await writeFile(path, Buffer.from(file.base64, "base64"));
  try {
    const result = await runCommand("tesseract", [path, "stdout", "-l", "eng"], 1000 * 45);
    return result.code === 0 ? result.output : "";
  } finally {
    await unlink(path).catch(() => {});
  }
}

function isImage(file) {
  return IMAGE_TYPES.has(file.type) || /\.(png|jpe?g|tiff?)$/i.test(file.name || "");
}

function installCommand() {
  if (process.platform === "darwin" && spawnSync("brew", ["--version"], { encoding: "utf8" }).status === 0) {
    return ["brew", "install", "tesseract"];
  }
  return null;
}

function runCommand(command, args, timeoutMs) {
  return new Promise((resolveResult) => {
    const child = spawn(command, args, { stdio: ["ignore", "pipe", "pipe"] });
    let output = "";
    const timer = setTimeout(() => {
      child.kill("SIGTERM");
    }, timeoutMs);
    child.stdout.on("data", (chunk) => {
      output += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      output += chunk.toString();
    });
    child.on("error", (error) => {
      clearTimeout(timer);
      resolveResult({ code: 1, output: error.message });
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      resolveResult({ code, output });
    });
  });
}

function firstLine(value = "") {
  return value.split("\n").find(Boolean) || "tesseract";
}
