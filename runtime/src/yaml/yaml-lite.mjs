// yaml-lite: a deliberately small, dependency-free parser for the YAML
// *subset* used by agents/*/agent.yaml and workflows/*.yaml in this repo.
//
// Supported: block mappings, block sequences (including sequences of
// mappings), block scalars ("|" literal, ">" folded), single/double quoted
// scalars, plain scalars, comments, blank lines, null ("~"/"null"/empty),
// booleans, numbers. NOT supported (and not needed by this repo's files):
// flow style ({}/[]), anchors/aliases, multi-document streams, tags.
//
// This exists because adf-core is intentionally zero-dependency (see
// adf-core/README.md) and the Harness follows the same principle: no
// npm install, no node_modules, plain Node ESM.

import fs from "node:fs";

function stripComment(line) {
  let inSingle = false;
  let inDouble = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === "'" && !inDouble) inSingle = !inSingle;
    else if (ch === '"' && !inSingle) inDouble = !inDouble;
    else if (ch === "#" && !inSingle && !inDouble) {
      if (i === 0 || /\s/.test(line[i - 1])) return line.slice(0, i);
    }
  }
  return line;
}

const KEY_LINE_RE = /^[A-Za-z0-9_.$<>*/-]+:(\s.*|)$/;
const BLOCK_SCALAR_INTRO_RE = /:\s*([|>])\s*$/;

// Plain and quoted YAML scalars may wrap across multiple physical lines,
// with the continuation simply indented deeper than the line it continues
// (e.g. a "- \"...\n    ...\"" list item, or a "- some prose\n    more
// prose" item). This folds those continuation lines back into the logical
// line they belong to *before* the indentation-based structural parser
// runs, so that parser never has to reason about wrapped scalars itself.
// Lines inside a "|"/">" block scalar are left untouched — their line
// breaks are semantically significant and are handled by readBlockScalar.
function mergeContinuations(rawLines) {
  const out = [];
  let blockScalarBaseIndent = null;

  for (const raw of rawLines) {
    const trimmed = raw.trim();
    const curIndent = indentOf(raw);

    if (blockScalarBaseIndent !== null) {
      if (trimmed !== "" && curIndent <= blockScalarBaseIndent) {
        blockScalarBaseIndent = null;
      } else {
        out.push(raw);
        continue;
      }
    }

    if (trimmed !== "" && out.length > 0 && out[out.length - 1].trim() !== "") {
      const prev = out[out.length - 1];
      const prevIndent = indentOf(prev);
      const isListItem = /^-(\s|$)/.test(trimmed);
      const isKey = KEY_LINE_RE.test(trimmed);
      if (curIndent > prevIndent && !isListItem && !isKey) {
        out[out.length - 1] = prev + " " + trimmed;
        continue;
      }
    }

    out.push(raw);
    if (BLOCK_SCALAR_INTRO_RE.test(trimmed)) {
      blockScalarBaseIndent = curIndent;
    }
  }

  return out;
}

function indentOf(line) {
  const m = line.match(/^ */);
  return m[0].length;
}

function parseScalar(raw) {
  const s = raw.trim();
  if (s === "") return null;
  if (s === "~" || s === "null" || s === "Null" || s === "NULL") return null;
  if (s === "true" || s === "True" || s === "TRUE") return true;
  if (s === "false" || s === "False" || s === "FALSE") return false;
  if (/^-?\d+$/.test(s)) return parseInt(s, 10);
  if (/^-?\d+\.\d+$/.test(s)) return parseFloat(s);
  if (s.startsWith('"') && s.endsWith('"') && s.length >= 2) {
    return JSON.parse(s);
  }
  if (s.startsWith("'") && s.endsWith("'") && s.length >= 2) {
    return s.slice(1, -1).replace(/''/g, "'");
  }
  if (
    (s.startsWith("[") && s.endsWith("]")) ||
    (s.startsWith("{") && s.endsWith("}"))
  ) {
    try {
      return JSON.parse(s);
    } catch {
      return s;
    }
  }
  return s;
}

// Splits "key: value" on the first unquoted colon followed by a space or
// end-of-line (so URLs like "http://x" inside quoted values are untouched).
function splitKeyValue(line) {
  let inSingle = false;
  let inDouble = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === "'" && !inDouble) inSingle = !inSingle;
    else if (ch === '"' && !inSingle) inDouble = !inDouble;
    else if (ch === ":" && !inSingle && !inDouble) {
      const next = line[i + 1];
      if (next === undefined || next === " ") {
        return [line.slice(0, i), line.slice(i + 1).trim()];
      }
    }
  }
  return null;
}

class LineReader {
  constructor(rawLines) {
    // Each entry: { indent, content, raw, blockScalarIndent? }
    this.lines = rawLines;
    this.pos = 0;
  }
  peek() {
    return this.pos < this.lines.length ? this.lines[this.pos] : null;
  }
  next() {
    return this.lines[this.pos++];
  }
  eof() {
    return this.pos >= this.lines.length;
  }
  // Looks ahead past blank lines (without consuming anything) and returns
  // the indent of the next non-blank line, or -1 if none remains. Needed
  // because a mapping value's nested block may be separated from its key
  // by one or more blank lines (e.g. "definition_of_done:\n\n  - item").
  peekNextNonBlankIndent() {
    const line = this.peekNextNonBlank();
    return line ? indentOf(line.raw) : -1;
  }
  // Same lookahead, but returns the line object itself (still unconsumed).
  peekNextNonBlank() {
    for (let i = this.pos; i < this.lines.length; i++) {
      if (this.lines[i].raw.trim() !== "") return this.lines[i];
    }
    return null;
  }
}

function readBlockScalar(reader, parentIndent, style) {
  const collected = [];
  let scalarIndent = null;
  while (!reader.eof()) {
    const line = reader.peek();
    if (line.raw.trim() === "") {
      collected.push("");
      reader.next();
      continue;
    }
    const ind = indentOf(line.raw);
    if (ind <= parentIndent) break;
    if (scalarIndent === null) scalarIndent = ind;
    collected.push(line.raw.slice(scalarIndent));
    reader.next();
  }
  while (collected.length && collected[collected.length - 1] === "") {
    collected.pop();
  }
  if (style === "|") return collected.join("\n") + (collected.length ? "\n" : "");
  return collected.join(" ").replace(/\s+/g, " ").trim() + "\n";
}

function parseBlock(reader, minIndent) {
  // Decide whether this block is a sequence or a mapping by looking at the
  // first non-blank line at >= minIndent (skipping any blank lines that
  // separate the parent key from its nested block).
  const first = reader.peekNextNonBlank();
  if (!first || indentOf(first.raw) < minIndent) return null;
  const isSeq = first.raw.trim().startsWith("- ") || first.raw.trim() === "-";
  return isSeq ? parseSequence(reader, indentOf(first.raw)) : parseMapping(reader, indentOf(first.raw));
}

function parseSequence(reader, indent) {
  const arr = [];
  while (!reader.eof()) {
    const line = reader.peek();
    if (line.raw.trim() === "") {
      reader.next();
      continue;
    }
    const ind = indentOf(line.raw);
    if (ind < indent) break;
    if (ind > indent) break; // malformed / belongs to a deeper structure already consumed
    const trimmed = line.raw.trim();
    if (!(trimmed.startsWith("- ") || trimmed === "-")) break;
    reader.next();
    const rest = trimmed === "-" ? "" : trimmed.slice(2);
    if (rest === "") {
      // Item value is a nested block on following lines.
      const nested = parseBlock(reader, indent + 1);
      arr.push(nested);
      continue;
    }
    const kv = splitKeyValue(rest);
    if (kv) {
      // Sequence of mappings: "- key: value" starts an inline mapping whose
      // effective indent is the column right after "- ".
      const mapIndent = indent + 2;
      const obj = {};
      applyKeyValueLine(obj, kv, reader, mapIndent);
      // Continue reading sibling keys at mapIndent that belong to this item.
      while (!reader.eof()) {
        const l = reader.peek();
        if (l.raw.trim() === "") {
          reader.next();
          continue;
        }
        const i2 = indentOf(l.raw);
        if (i2 !== mapIndent) break;
        const t2 = l.raw.trim();
        if (t2.startsWith("- ") || t2 === "-") break;
        const kv2 = splitKeyValue(t2);
        if (!kv2) break;
        reader.next();
        applyKeyValueLine(obj, kv2, reader, mapIndent);
      }
      arr.push(obj);
    } else {
      arr.push(parseScalar(rest));
    }
  }
  return arr;
}

function applyKeyValueLine(obj, [rawKey, rawValue], reader, indent) {
  const key = rawKey.trim().replace(/^["']|["']$/g, "");
  const value = rawValue;
  if (value === "" ) {
    // Value is on following lines (possibly after blank lines): nested
    // block, or nothing (null) if nothing more-indented follows.
    const nextIndent = reader.peekNextNonBlankIndent();
    if (nextIndent > indent) {
      obj[key] = parseBlock(reader, indent + 1);
    } else {
      obj[key] = null;
    }
    return;
  }
  if (value === "|" || value === ">" || value.startsWith("|") || value.startsWith(">")) {
    const style = value[0];
    obj[key] = readBlockScalar(reader, indent, style);
    return;
  }
  obj[key] = parseScalar(value);
}

function parseMapping(reader, indent) {
  const obj = {};
  while (!reader.eof()) {
    const line = reader.peek();
    if (line.raw.trim() === "") {
      reader.next();
      continue;
    }
    const ind = indentOf(line.raw);
    if (ind !== indent) break;
    const trimmed = line.raw.trim();
    const kv = splitKeyValue(trimmed);
    if (!kv) break;
    reader.next();
    applyKeyValueLine(obj, kv, reader, indent);
  }
  return obj;
}

export function parseYaml(text) {
  const stripped = text
    .split(/\r?\n/)
    .map((raw) => stripComment(raw))
    .filter((raw) => !(raw.trim() === "---" || raw.trim() === "..."));
  const merged = mergeContinuations(stripped);
  const rawLines = merged.map((raw) => ({ raw }));
  const reader = new LineReader(rawLines);
  const result = parseBlock(reader, 0);
  return result === null ? {} : result;
}

export function parseYamlFile(filePath) {
  return parseYaml(fs.readFileSync(filePath, "utf8"));
}
