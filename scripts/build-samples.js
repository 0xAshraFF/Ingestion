import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const bundledPython = "/Users/ash/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3";
const python = existsSync(bundledPython) ? bundledPython : "python3";

const generated = spawnSync(python, ["scripts/generate-legal-demo-assets.py"], {
  stdio: "inherit"
});
if (generated.status !== 0) {
  process.exit(generated.status || 1);
}

await import("./build-handwritten-sample.js");
await import("./build-legal-demo-sample.js");

await mkdir("results", { recursive: true });

const legalCsv = await readFile("results/legal-demo/model-confidence-results.csv", "utf8");
const handwrittenReport = await readFile("results/handwritten-analytical-positivism/evaluation-report.md", "utf8");

const legalRows = legalCsv.trim().split("\n").slice(1).map((line) => line.split(","));
const legalTable = [
  "| input doc | model used | confidence metric | accuracy proxy | quality band | fallback used |",
  "|---|---:|---:|---:|---:|---:|",
  ...legalRows.map(([sampleDoc, modelUsed, confidenceMetric, accuracyProxy, qualityBand, fallbackUsed]) =>
    `| ${sampleDoc} | ${modelUsed} | ${confidenceMetric} | ${accuracyProxy} | ${qualityBand} | ${fallbackUsed} |`
  )
].join("\n");

const handwrittenQuality = handwrittenReport
  .split("## Quality Result")[1]
  ?.split("## Generated Draft")[0]
  ?.trim() || "No handwritten metrics available.";

const combined = `# Actual Results

## Legal Demo Model Metrics

${legalTable}

## Handwritten Notes Summary

${handwrittenQuality}
`;

await writeFile(join("results", "model-confidence.md"), combined);
await writeFile(join("results", "model-confidence.csv"), legalCsv);

console.log("Combined actual results written to results/");
