import test from "node:test";
import assert from "node:assert/strict";
import { aggregateQuality, calculateQuality, needsFallback, qualityBand } from "../src/lib/quality.js";

test("quality bands follow spec thresholds", () => {
  assert.equal(qualityBand({ ocrConfidence: 92, pageCoverage: 0.98 }), "green");
  assert.equal(qualityBand({ ocrConfidence: 82, pageCoverage: 0.9 }), "amber");
  assert.equal(qualityBand({ ocrConfidence: 70, pageCoverage: 0.9 }), "red");
});

test("fallback triggers on low confidence and poor coverage", () => {
  assert.equal(needsFallback({ ocrConfidence: 74, pageCoverage: 0.95, fieldCompleteness: 0.9 }), true);
  assert.equal(needsFallback({ ocrConfidence: 88, pageCoverage: 0.7, fieldCompleteness: 0.9 }), true);
  assert.equal(needsFallback({ ocrConfidence: 91, pageCoverage: 0.96, fieldCompleteness: 0.8 }), false);
});

test("aggregate quality keeps the lowest page band visible", () => {
  const green = calculateQuality({ text: "word ".repeat(180), sourceType: "txt" });
  const red = calculateQuality({ text: "short", sourceType: "image", hints: ["noisy"] });
  const aggregate = aggregateQuality([green, red]);
  assert.equal(aggregate.band, "red");
  assert.equal(aggregate.fallbackPageCount, 0);
});
