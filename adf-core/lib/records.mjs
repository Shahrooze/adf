import path from "node:path";
import {
  listFeatureEntries,
  readManifest,
  idFromDirName,
  deriveStageData,
  orphanFiles,
  toRelative,
} from "./feature-io.mjs";

// Builds the single normalized view every command (generate, validate,
// sync) operates on, so "what does a feature currently look like" is
// computed exactly once, the same way, everywhere.
export function buildRecords() {
  return listFeatureEntries().map((entry) => {
    const manifest = readManifest(entry.dir);
    const expectedId = idFromDirName(entry.name);
    return {
      name: entry.name,
      dir: entry.dir,
      relPath: toRelative(entry.dir),
      archived: entry.archived,
      expectedId,
      manifest,
      derived: deriveStageData(entry.dir),
      orphans: orphanFiles(entry.dir, manifest),
    };
  });
}

export function recordId(record) {
  return record.manifest?.id ?? record.expectedId;
}
