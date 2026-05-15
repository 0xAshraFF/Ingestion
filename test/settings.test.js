import test from "node:test";
import assert from "node:assert/strict";
import { providerSettings } from "../src/lib/providers.js";
import { localOcrStatus } from "../src/lib/localOcr.js";

test("provider settings redact saved BYOK keys", () => {
  const settings = providerSettings({}, {
    providers: {
      GEMINI_API_KEY: "secret-gemini",
      ANTHROPIC_API_KEY: "secret-claude",
      GEMINI_VISION_MODEL: "gemini-test",
      CLAUDE_VISION_MODEL: "claude-test"
    }
  });

  assert.equal(settings.providers[0].available, true);
  assert.equal(settings.providers[0].configured, "set");
  assert.equal(settings.providers[0].model, "gemini-test");
  assert.equal(JSON.stringify(settings).includes("secret-gemini"), false);
});

test("local OCR status returns install metadata", () => {
  const status = localOcrStatus();
  assert.equal(status.engine, "tesseract");
  assert.equal(typeof status.available, "boolean");
  assert.ok("installCommand" in status);
});
