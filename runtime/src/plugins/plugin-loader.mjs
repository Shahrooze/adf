// Discovers every plugins/<name>/plugin.json, imports its entrypoint, and
// calls its default export's register(ctx) with a PluginContext. A
// broken plugin is reported and skipped — it never takes the rest of the
// Harness down with it, since plugin quality is outside the Harness's
// control the same way a project's own agents are.
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { REPO_ROOT } from "../config/paths.mjs";

export class PluginLoader {
  constructor({ config, logger = null }) {
    this.directories = (config.plugins?.directories ?? ["plugins"]).map((d) =>
      path.isAbsolute(d) ? d : path.join(REPO_ROOT, d)
    );
    this.autoload = config.plugins?.autoload ?? true;
    this.logger = logger;
  }

  discover() {
    const found = [];
    for (const dir of this.directories) {
      if (!fs.existsSync(dir)) continue;
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (!entry.isDirectory()) continue;
        const pluginDir = path.join(dir, entry.name);
        const manifestPath = path.join(pluginDir, "plugin.json");
        if (!fs.existsSync(manifestPath)) continue;
        try {
          const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
          found.push({ manifest, pluginDir, manifestPath });
        } catch (err) {
          found.push({ manifest: null, pluginDir, manifestPath, error: `invalid plugin.json: ${err.message}` });
        }
      }
    }
    return found;
  }

  async loadAll(pluginContext) {
    const results = [];
    if (!this.autoload) return results;

    for (const entry of this.discover()) {
      if (!entry.manifest) {
        results.push({ id: path.basename(entry.pluginDir), loaded: false, error: entry.error });
        this.logger?.error?.(`Plugin at "${entry.pluginDir}" failed to load: ${entry.error}`, {});
        continue;
      }
      const id = entry.manifest.id ?? path.basename(entry.pluginDir);
      try {
        const mainFile = path.join(entry.pluginDir, entry.manifest.main ?? "index.mjs");
        const mod = await import(pathToFileURL(mainFile).href);
        if (typeof mod.register !== "function" && typeof mod.default?.register !== "function") {
          throw new Error(`plugin entrypoint "${mainFile}" does not export a register(ctx) function`);
        }
        const register = mod.register ?? mod.default.register;
        await register(pluginContext);
        results.push({ id, name: entry.manifest.name ?? id, version: entry.manifest.version ?? "0.0.0", loaded: true });
        this.logger?.info?.(`Plugin "${id}" loaded`, {});
      } catch (err) {
        results.push({ id, loaded: false, error: err.message });
        this.logger?.error?.(`Plugin "${id}" failed to load: ${err.message}`, { error: err.message });
      }
    }
    return results;
  }
}
