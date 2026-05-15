import { access } from "node:fs/promises";

const required = [
  "src/server.js",
  "src/lib/intake.js",
  "src/lib/sampleTranscripts.js",
  "src/lib/quality.js",
  "src/lib/providers.js",
  "src/lib/retrieval.js",
  "src/lib/drafts.js",
  "src/lib/editLearning.js",
  "src/lib/exportBundle.js",
  "public/index.html",
  "public/app.js",
  "public/styles.css"
];

await Promise.all(required.map((file) => access(file)));
console.log(`Build check passed: ${required.length} required files found.`);
