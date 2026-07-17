import fs from "node:fs";
import path from "node:path";
import {
  FEATURES_DIR,
  ARCHIVE_DIR,
  listDirs,
  readTextIfExists,
  readJsonIfExists,
  writeJson,
  extractStatusLine,
  extractOverallResult,
  relativeToRoot,
} from "./fs-utils.mjs";
import { STAGES, ARTIFACT_FILENAMES, STATUS_SUMMARY_FIELDS } from "./workflow-stages.mjs";

const FEATURE_ID_PATTERN = /^FEAT-\d{3,}$/;

// Files every feature directory is allowed to contain without being flagged
// as an orphan: the eleven pipeline artifacts, the registry manifest itself,
// and anything the feature explicitly declares via feature.json's
// `supplementary_documents` (e.g. a product-discovery doc, an
// architecture-constraints brief supplied by the product owner — real
// examples already exist in this repo, see FEAT-008 and FEAT-032).
export function knownFilesFor(manifest) {
  const extra = manifest?.supplementary_documents ?? [];
  return new Set([...ARTIFACT_FILENAMES, "feature.json", ...extra]);
}

export function listFeatureEntries() {
  const active = listDirs(FEATURES_DIR).map((name) => ({
    name,
    dir: path.join(FEATURES_DIR, name),
    archived: false,
  }));
  const archived = listDirs(ARCHIVE_DIR).map((name) => ({
    name,
    dir: path.join(ARCHIVE_DIR, name),
    archived: true,
  }));
  return [...active, ...archived];
}

export function readManifest(featureDir) {
  return readJsonIfExists(path.join(featureDir, "feature.json"));
}

export function writeManifest(featureDir, manifest) {
  writeJson(path.join(featureDir, "feature.json"), manifest);
}

export function idFromDirName(dirName) {
  const match = dirName.match(/^(FEAT-\d{3,}|BUG-[A-Z0-9-]+)/);
  return match ? match[1] : dirName;
}

export function isValidFeatureId(id) {
  return FEATURE_ID_PATTERN.test(id) || /^BUG-[A-Z0-9-]+$/.test(id);
}

// Scans a feature directory's artifacts against the canonical stage table
// and derives everything that must never be hand-maintained: which stage
// was last completed, each stage's gate status, and the mission-defined
// named status fields (architecture_status, backend_status, ...).
export function deriveStageData(featureDir) {
  const documents = {};
  const gates = {};
  let lastCompletedStage = null;
  let blockedAt = null;

  for (const stage of STAGES) {
    const filePath = path.join(featureDir, stage.artifact);
    const text = readTextIfExists(filePath);
    if (text === null) {
      documents[stage.id] = null;
      gates[stage.id] = null;
      continue;
    }
    const status = extractStatusLine(text);
    const recommendation = extractOverallResult(text);
    documents[stage.id] = {
      file: stage.artifact,
      status,
      recommendation,
    };
    gates[stage.id] = status;

    if (status === stage.readyStatus) {
      lastCompletedStage = stage.id;
    } else if (status && !blockedAt) {
      // Artifact exists but its own gate wasn't satisfied (e.g.
      // CHANGES_REQUIRED, REJECTED, or a stale/incorrect status).
      blockedAt = { stage: stage.id, status };
    }
  }

  const released = gates["code-review"] === "RELEASE_READY";
  let completionStatus;
  if (released) completionStatus = "Release Ready";
  else if (blockedAt) completionStatus = `Blocked at ${blockedAt.stage} (${blockedAt.status})`;
  else if (lastCompletedStage) completionStatus = `In Progress (past ${lastCompletedStage})`;
  else completionStatus = "Not Started";

  const statusSummary = { completion_status: completionStatus };
  for (const [field, stageIds] of Object.entries(STATUS_SUMMARY_FIELDS)) {
    let value = null;
    for (const sid of stageIds) {
      if (gates[sid]) {
        value = gates[sid];
        break;
      }
    }
    statusSummary[field] = value;
  }

  return {
    stage: lastCompletedStage,
    gates,
    documents,
    status_summary: statusSummary,
  };
}

export function listArtifactFiles(featureDir) {
  return fs
    .readdirSync(featureDir, { withFileTypes: true })
    .filter((e) => e.isFile())
    .map((e) => e.name);
}

export function orphanFiles(featureDir, manifest) {
  const known = knownFilesFor(manifest);
  return listArtifactFiles(featureDir).filter((f) => !known.has(f));
}

export function toRelative(p) {
  return relativeToRoot(p);
}
