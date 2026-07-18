import path from "node:path";
import { REPO_ROOT, readJsonIfExists, writeJson } from "./fs-utils.mjs";

export const CONFIG_PATH = path.join(REPO_ROOT, "adf.config.json");

export function readConfig() {
  return readJsonIfExists(CONFIG_PATH);
}

export function writeConfig(config) {
  writeJson(CONFIG_PATH, config);
}
