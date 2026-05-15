const DATE_RE = /\b(?:\d{4}-\d{2}-\d{2}|\d{1,2}\/\d{1,2}\/\d{2,4}|(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\.?\s+\d{1,2},?\s+\d{4})\b/gi;
const AMOUNT_RE = /(?:USD\s*)?\$\s?\d[\d,]*(?:\.\d{2})?/gi;
const ADDRESS_RE = /\b\d{1,6}[ \t]+[A-Za-z0-9 .'-]+(?:Street|St|Road|Rd|Avenue|Ave|Lane|Ln|Drive|Dr|Boulevard|Blvd)\b/gi;
const HEADING_RE = /^#{1,3}\s+(.{3,80})$/gm;
const NUMBER_RE = /\b\d{1,3}(?:,\d{3})+(?:\.\d+)?\b|\b\d+\.\d{2}\b/g;
const NAME_RE = /\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,2}\b/g;

export const PROFILES = {
  auto: { id: "auto", label: "Auto-detect" },
  legal_notice: {
    id: "legal_notice",
    label: "Legal notice",
    extract(document, allText) {
      return {
        title: inferTitle(document, allText),
        dates: unique(allText.match(DATE_RE), 12),
        amounts: unique(allText.match(AMOUNT_RE), 12),
        addresses: unique(allText.match(ADDRESS_RE), 8),
        parties: inferParties(allText),
        deadlines: unique(allText.match(/\b(?:deadline|due|respond by|before|no later than)\s+.{0,48}/gi), 8)
      };
    }
  },
  book_page: {
    id: "book_page",
    label: "Book page",
    extract(document, allText) {
      const chapterMatch = allText.match(/\b(?:chapter|ch\.?)\s+(?:\d+|[IVXLC]+|[A-Z][a-z]+)\b[^\n]{0,60}/i);
      const authorMatch = allText.match(/\b(?:by|author[:\s])[ \t]+([A-Z][a-zA-Z. '-]+(?:[ \t]+[A-Z][a-zA-Z. '-]+){0,3})/);
      const pageMatch = allText.match(/\bpage\s+(\d{1,4})\b/i);
      return {
        title: inferTitle(document, allText),
        author: authorMatch ? authorMatch[1].trim() : null,
        chapter: chapterMatch ? chapterMatch[0].trim() : null,
        page_number: pageMatch ? Number(pageMatch[1]) : null,
        headings: unique(allText.match(HEADING_RE)?.map((line) => line.replace(/^#+\s+/, "")), 12),
        key_terms: inferKeyTerms(allText),
        quotations: unique(allText.match(/"([^"\n]{20,200})"/g), 6),
        citations: unique(allText.match(/\b[A-Z][a-z]+\s+\(\d{4}\)|\[\d+\]|\(\d{4}[a-z]?\)/g), 12)
      };
    }
  },
  receipt_invoice: {
    id: "receipt_invoice",
    label: "Receipt / invoice",
    extract(document, allText) {
      const vendorMatch = allText.match(/(?:vendor|from|bill\s*to|sold\s*by)\s*[:\-]\s*([A-Z][A-Za-z0-9 &'.,-]{2,60})/i);
      const invoiceMatch = allText.match(/\b(?:invoice|inv|receipt|order)\s*#?\s*[:\-]?\s*([A-Z0-9-]{3,20})/i);
      const totalMatch = allText.match(/\btotal\s*[:\-]?\s*(?:USD\s*)?\$?\s?(\d[\d,]*(?:\.\d{2})?)/i);
      const taxMatch = allText.match(/\b(?:tax|vat|gst)\s*[:\-]?\s*\$?\s?(\d[\d,]*(?:\.\d{2})?)/i);
      const currencyMatch = allText.match(/\b(USD|EUR|GBP|CAD|AUD|INR|JPY|CNY|BDT)\b/);
      const lineItems = [...allText.matchAll(/^\s*([A-Za-z][A-Za-z0-9 .,'-]{2,60})\s+\$?(\d[\d,]*(?:\.\d{2})?)\s*$/gm)]
        .slice(0, 20)
        .map((match) => ({ description: match[1].trim(), amount: match[2] }));
      return {
        vendor: vendorMatch ? vendorMatch[1].trim() : null,
        invoice_number: invoiceMatch ? invoiceMatch[1] : null,
        date: (allText.match(DATE_RE) || [])[0] || null,
        total: totalMatch ? totalMatch[1] : null,
        currency: currencyMatch ? currencyMatch[1] : (allText.includes("$") ? "USD" : null),
        tax: taxMatch ? taxMatch[1] : null,
        line_items: lineItems,
        address: (allText.match(ADDRESS_RE) || [])[0] || null
      };
    }
  },
  study_note: {
    id: "study_note",
    label: "Study note",
    extract(document, allText) {
      const headings = unique(allText.match(HEADING_RE)?.map((line) => line.replace(/^#+\s+/, "")), 12);
      const topic = headings[0] || inferTitle(document, allText);
      const definitions = unique(
        allText.match(/\b[A-Z][a-zA-Z]+\s+(?:is|means|refers to|describes|denotes)\b[^.\n]{10,180}\.?/g),
        10
      );
      const references = unique(
        allText.match(/(?:see|cf\.|ref(?:erence)?|cite[ds]?)[:\s]+[A-Z][^.\n]{3,120}/gi),
        8
      );
      return {
        topic,
        key_concepts: inferKeyTerms(allText),
        definitions,
        thinkers_mentioned: inferThinkers(allText),
        references,
        headings
      };
    }
  },
  generic: {
    id: "generic",
    label: "Generic",
    extract(document, allText) {
      return {
        title: inferTitle(document, allText),
        dates: unique(allText.match(DATE_RE), 12),
        names: unique(allText.match(NAME_RE), 12),
        numbers: unique(allText.match(NUMBER_RE), 12),
        headings: unique(allText.match(HEADING_RE)?.map((line) => line.replace(/^#+\s+/, "")), 12)
      };
    }
  }
};

export function listProfiles() {
  return Object.values(PROFILES).map(({ id, label }) => ({ id, label }));
}

export function detectProfile(document, allText) {
  const fileNames = (document.files || []).map((file) => file.name.toLowerCase()).join(" ");
  const haystack = `${fileNames}\n${allText.toLowerCase()}`;

  if (/\b(isbn|chapter|copyright\s+\d{4}|published by|pp?\.\s*\d|hardcover|paperback)\b/.test(haystack)) {
    return "book_page";
  }
  if (/\b(notice|tenant|landlord|plaintiff|defendant|summons|deadline|respond by|civil action)\b/.test(haystack)) {
    return "legal_notice";
  }
  if (/\b(invoice|receipt|subtotal|sales tax|bill to|sold by|invoice\s*#|order\s*#)\b/.test(haystack)) {
    return "receipt_invoice";
  }
  if (/\b(positivism|jurisprudence|utilitarianism|hart|kelsen|austin|bentham|grundnorm|study note|lecture)\b/.test(haystack)) {
    return "study_note";
  }
  return "generic";
}

export function applyProfile(document, profileId = "auto") {
  const allText = document.pages.map((page) => page.text).join("\n");
  const resolvedId = profileId === "auto" ? detectProfile(document, allText) : profileId;
  const profile = PROFILES[resolvedId] || PROFILES.generic;
  return {
    profile: profile.id,
    fields: profile.extract(document, allText)
  };
}

function inferTitle(document, allText) {
  const firstLine = allText.split(/\n/).map((line) => line.replace(/^#+\s*/, "").trim()).find(Boolean);
  return firstLine?.slice(0, 90) || document.title;
}

function inferParties(text) {
  const labels = unique(
    text.match(/\b(?:tenant|landlord|plaintiff|defendant|client|applicant|respondent|petitioner)\s*:\s*[A-Z][A-Za-z .'-]+/gi),
    12
  );
  if (labels.length) return labels;
  return unique(text.match(NAME_RE), 8);
}

function inferKeyTerms(text) {
  const candidates = (text.match(/\b[A-Z][a-z]{3,}(?:\s+[a-z]{3,}){0,2}\b/g) || [])
    .filter((term) => term.split(/\s+/).length <= 3);
  const counts = new Map();
  for (const term of candidates) {
    counts.set(term, (counts.get(term) || 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([term]) => term);
}

function inferThinkers(text) {
  const known = ["Austin", "Bentham", "Hart", "Kelsen", "Hobbes", "Locke", "Kant", "Mill", "Dworkin", "Raz", "Finnis", "Aristotle", "Plato"];
  return known.filter((name) => new RegExp(`\\b${name}\\b`).test(text));
}

function unique(matches, limit = 12) {
  if (!matches) return [];
  return [...new Set(matches.map((value) => String(value).trim()))].slice(0, limit);
}
