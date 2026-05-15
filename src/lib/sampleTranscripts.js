import { readFileSync } from "node:fs";
import { basename, join } from "node:path";

const HANDWRITTEN_DIR = "inputs/handwritten-analytical-positivism/transcripts";

const TRANSCRIPT_BY_FILE = new Map([
  ["485802611_1065508318950583_1897469731717348318_n.jpg", "page-01-analytical-positivism.md"],
  ["page-01-analytical-positivism.jpg", "page-01-analytical-positivism.md"],
  ["485762135_1065508202283928_6317553943397879159_n.jpg", "page-02-austin-positive-law.md"],
  ["page-02-austin-positive-law.jpg", "page-02-austin-positive-law.md"],
  ["485159338_1065509308950484_7667962008053286287_n.jpg", "page-03-bentham-utilitarianism.md"],
  ["page-03-bentham-utilitarianism.jpg", "page-03-bentham-utilitarianism.md"],
  ["485646531_1065507998950615_2932128619184326718_n.jpg", "page-04-hart-rules.md"],
  ["page-04-hart-rules.jpg", "page-04-hart-rules.md"],
  ["485764245_1065509055617176_5840917365785524334_n.jpg", "page-05-kelsen-pure-theory.md"],
  ["page-05-kelsen-pure-theory.jpg", "page-05-kelsen-pure-theory.md"]
]);

export function lookupSampleTranscript(fileName) {
  const transcriptName = TRANSCRIPT_BY_FILE.get(basename(fileName || ""));
  if (!transcriptName) return null;

  try {
    return readFileSync(join(HANDWRITTEN_DIR, transcriptName), "utf8");
  } catch {
    return null;
  }
}
