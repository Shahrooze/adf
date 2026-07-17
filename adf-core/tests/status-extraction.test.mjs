import test from "node:test";
import assert from "node:assert/strict";
import { extractStatusLine, extractOverallResult } from "../lib/fs-utils.mjs";

test("extracts a plain terminal STATUS line", () => {
  assert.equal(extractStatusLine("Some report.\n\nSTATUS: READY_FOR_BACKEND\n"), "READY_FOR_BACKEND");
});

test("extracts a bold-wrapped terminal STATUS line", () => {
  assert.equal(extractStatusLine("...\n**STATUS: RELEASE_READY**"), "RELEASE_READY");
});

test("ignores STATUS mentioned mid-sentence, not on its own line", () => {
  const text = `"Excellent... SOLID... APPROVED" and \`STATUS: RELEASE_READY\`. That conclusion did not\nhold.\n\n**STATUS: CHANGES_REQUIRED**`;
  assert.equal(extractStatusLine(text), "CHANGES_REQUIRED");
});

test("skips trailing blockquote annotation lines after STATUS", () => {
  const text = [
    "STATUS: READY_FOR_FRONTEND",
    "",
    "> Backend Layer finishes with STATUS: READY_FOR_FRONTEND.",
    "> Frontend Layer finishes with STATUS: READY_FOR_QA.",
  ].join("\n");
  assert.equal(extractStatusLine(text), "READY_FOR_FRONTEND");
});

test("returns null when real content (not a blockquote) follows STATUS", () => {
  const text = ["STATUS: READY_FOR_SECURITY_REVIEW", "", "## Gaps", "", "None remain."].join("\n");
  assert.equal(extractStatusLine(text), null);
});

test("returns null for missing or empty text", () => {
  assert.equal(extractStatusLine(null), null);
  assert.equal(extractStatusLine(""), null);
});

test("extracts Overall Result recommendation", () => {
  const text = "# Overall Result\n\nAPPROVED_WITH_COMMENTS\n\n# Findings\n";
  assert.equal(extractOverallResult(text), "APPROVED_WITH_COMMENTS");
});

test("Overall Result extraction returns null when absent", () => {
  assert.equal(extractOverallResult("# Summary\n\nNo result section.\n"), null);
});
