import fs from "node:fs";
import path from "node:path";

export const REPO_ROOT = path.resolve(
  path.dirname(new URL(import.meta.url).pathname),
  "..",
  ".."
);

export const FEATURES_DIR = path.join(REPO_ROOT, "features");
export const ARCHIVE_DIR = path.join(REPO_ROOT, "_archive");
export const ADF_CORE_DIR = path.join(REPO_ROOT, "adf-core");

export function listDirs(parent) {
  if (!fs.existsSync(parent)) return [];
  return fs
    .readdirSync(parent, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort();
}

export function readTextIfExists(filePath) {
  return fs.existsSync(filePath) ? fs.readFileSync(filePath, "utf8") : null;
}

export function readJsonIfExists(filePath) {
  const text = readTextIfExists(filePath);
  if (text === null) return null;
  return JSON.parse(text);
}

export function writeJson(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + "\n", "utf8");
}

export function writeText(filePath, text) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, text, "utf8");
}

// The repo-wide convention (see every templates/*.md) is that an artifact's
// gate status is its own LAST non-empty line, formatted `STATUS: VALUE`,
// optionally wrapped in markdown bold (`**STATUS: VALUE**`). Matching only
// the last line — instead of the first `STATUS:`-looking line anywhere in
// the file — avoids false positives from prose that quotes a status value
// mid-sentence (e.g. a report narrating a previous, superseded status).
//
// Trailing blank lines and trailing `>` blockquote lines are skipped before
// matching: templates/implementation-report.md itself appends a blockquote
// usage note directly after the STATUS line ("> Backend Layer finishes
// with..."), and several existing reports append their own explanatory
// blockquote after STATUS too. Skipping past blockquotes only — never past
// a heading or a plain paragraph — keeps this narrow: a report that
// genuinely has more document after STATUS (misplaced status line) still
// correctly fails to match.
export function extractStatusLine(text) {
  if (!text) return null;
  const lines = text.split(/\r?\n/);
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i].trim();
    if (line === "" || line.startsWith(">")) continue;
    const match = line.match(/^\*{0,2}STATUS:\s*([A-Z0-9_]+)\*{0,2}$/);
    return match ? match[1] : null;
  }
  return null;
}

// Best-effort, informational only: the value under "# Overall Result".
export function extractOverallResult(text) {
  if (!text) return null;
  const match = text.match(
    /^#\s*Overall Result\s*\n+([\s\S]*?)(?=\n#|\n---|\s*$)/m
  );
  if (!match) return null;
  const body = match[1];
  const known = [
    "APPROVED_WITH_COMMENTS",
    "APPROVED",
    "CHANGES_REQUIRED",
    "REJECTED",
  ];
  for (const value of known) {
    if (body.includes(value)) return value;
  }
  return null;
}

export function today() {
  const d = new Date();
  return d.toISOString().slice(0, 10);
}

export function relativeToRoot(absPath) {
  return path.relative(REPO_ROOT, absPath).split(path.sep).join("/");
}
