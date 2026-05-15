import test from "node:test";
import assert from "node:assert/strict";
import { ingestDocument, extractStructuredFields } from "../src/lib/intake.js";
import { applyProfile, detectProfile, PROFILES, listProfiles } from "../src/lib/schemaProfiles.js";

function docFromText(name, text) {
  return ingestDocument({
    files: [{ name, type: "text/plain", size: text.length || 1, text }]
  });
}

test("listProfiles exposes every profile id and label", () => {
  const ids = listProfiles().map((profile) => profile.id);
  for (const id of Object.keys(PROFILES)) {
    assert.ok(ids.includes(id), `missing profile ${id}`);
  }
});

test("legal_notice profile returns dates, amounts, parties, deadlines", () => {
  const document = docFromText("notice.txt",
    "Notice dated 2026-04-10. Tenant: Jane Rivera. Amount due: $1,250.00. Respond by 2026-04-20. Address: 100 Main Street.");
  const fields = extractStructuredFields(document, "legal_notice");
  assert.equal(fields.profile, "legal_notice");
  assert.ok(fields.dates.includes("2026-04-10"));
  assert.ok(fields.amounts.includes("$1,250.00"));
  assert.ok(fields.parties.some((party) => party.includes("Jane Rivera")));
  assert.ok(fields.deadlines.length > 0);
});

test("book_page profile extracts author, chapter, page number, key terms", () => {
  const document = docFromText("book.txt",
    "The Concept of Law\nby H. L. A. Hart\nChapter 5: Primary and Secondary Rules\nPage 42\nThis chapter discusses Primary Rules and Secondary Rules in Hart's framework.");
  const fields = extractStructuredFields(document, "book_page");
  assert.equal(fields.profile, "book_page");
  assert.match(fields.author || "", /Hart/);
  assert.match(fields.chapter || "", /Chapter 5/i);
  assert.equal(fields.page_number, 42);
  assert.ok(Array.isArray(fields.key_terms));
});

test("receipt_invoice profile pulls vendor, total, tax, invoice number", () => {
  const document = docFromText("invoice.txt",
    "Vendor: Acme Stationery Inc.\nInvoice #INV-00045\nDate: 2026-03-12\nSubtotal $40.00\nTax: $3.20\nTotal: $43.20\n100 Market Street");
  const fields = extractStructuredFields(document, "receipt_invoice");
  assert.equal(fields.profile, "receipt_invoice");
  assert.match(fields.vendor || "", /Acme/);
  assert.equal(fields.invoice_number, "INV-00045");
  assert.equal(fields.total, "43.20");
  assert.equal(fields.tax, "3.20");
});

test("study_note profile picks thinkers and key concepts", () => {
  const document = docFromText("notes.txt",
    "# Analytical Positivism\nAustin is associated with command theory and positive law.\nBentham developed utilitarianism.\nHart criticized Austin's command theory.\nKelsen built the Pure Theory of Law.");
  const fields = extractStructuredFields(document, "study_note");
  assert.equal(fields.profile, "study_note");
  assert.ok(fields.thinkers_mentioned.includes("Austin"));
  assert.ok(fields.thinkers_mentioned.includes("Bentham"));
  assert.ok(fields.thinkers_mentioned.includes("Hart"));
  assert.ok(fields.thinkers_mentioned.includes("Kelsen"));
});

test("generic profile is a structureless fallback", () => {
  const document = docFromText("misc.txt", "Random text with 1,234 and 56.78 numbers and a Name Here.");
  const fields = extractStructuredFields(document, "generic");
  assert.equal(fields.profile, "generic");
  assert.ok(Array.isArray(fields.names));
  assert.ok(Array.isArray(fields.numbers));
});

test("detectProfile picks legal_notice from notice/tenant cues", () => {
  const document = docFromText("notice.txt", "Notice to tenant: respond by deadline 2026-04-20. Landlord requires payment.");
  const allText = document.pages.map((page) => page.text).join("\n");
  assert.equal(detectProfile(document, allText), "legal_notice");
});

test("detectProfile picks study_note from jurisprudence cues", () => {
  const document = docFromText("page.txt", "Hart discusses analytical positivism and Kelsen's grundnorm in this lecture note.");
  const allText = document.pages.map((page) => page.text).join("\n");
  assert.equal(detectProfile(document, allText), "study_note");
});

test("detectProfile picks receipt_invoice from invoice cues", () => {
  const document = docFromText("inv.txt", "Invoice from Acme. Subtotal $40. Sales tax $3.20. Amount due: $43.20.");
  const allText = document.pages.map((page) => page.text).join("\n");
  assert.equal(detectProfile(document, allText), "receipt_invoice");
});

test("detectProfile picks book_page when ISBN/chapter present", () => {
  const document = docFromText("page.txt", "Chapter 3: Sovereignty. ISBN 978-0-19-876543-2. Copyright 2019 published by Oxford.");
  const allText = document.pages.map((page) => page.text).join("\n");
  assert.equal(detectProfile(document, allText), "book_page");
});

test("extractStructuredFields with auto resolves to a concrete profile", () => {
  const document = docFromText("notes.txt", "Hart discusses analytical positivism and Kelsen's grundnorm.");
  const fields = extractStructuredFields(document, "auto");
  assert.equal(fields.profile, "study_note");
});

test("applyProfile returns the resolved profile id", () => {
  const document = docFromText("inv.txt", "Invoice from Acme. Total: $40.00. Tax: $3.20.");
  const allText = document.pages.map((page) => page.text).join("\n");
  const { profile } = applyProfile(document, "auto");
  assert.equal(profile, detectProfile(document, allText));
});
