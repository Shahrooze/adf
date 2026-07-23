// Tools are plug-and-play: every tool is a metadata record (id, name,
// description, permissions, timeout, retries) plus a module path. The
// module itself is only imported lazily, on first use, via load() — so
// building the registry never requires every tool implementation to be
// present or side-effect free at startup. Plugins add more tools with
// register(); nothing here is hardcoded to a fixed tool list.
import path from "node:path";
import { pathToFileURL } from "node:url";
import { RUNTIME_DIR } from "../config/paths.mjs";
import { loadRuntimeConfig } from "../config/config-loader.mjs";

const TOOLS_IMPL_DIR = path.join(RUNTIME_DIR, "src", "tools", "impl");

export class ToolDescriptor {
  constructor({ id, name, description, module, permissions, timeoutMs, retries, source }) {
    if (!id) throw new Error("Tool descriptor requires an id");
    this.id = id;
    this.name = name ?? id;
    this.description = description ?? "";
    this.modulePath = path.isAbsolute(module || "")
      ? module
      : path.join(TOOLS_IMPL_DIR, module || `${id}-tool.mjs`);
    this.permissions = permissions ?? [];
    this.timeoutMs = timeoutMs ?? 30000;
    this.retries = retries ?? 0;
    this.source = source ?? "builtin";
    this._loaded = null;
  }

  async load() {
    if (!this._loaded) {
      this._loaded = await import(pathToFileURL(this.modulePath).href);
    }
    return this._loaded;
  }
}

export class ToolRegistry {
  constructor() {
    this._tools = new Map();
  }

  discover({ config } = {}) {
    const cfg = config ?? loadRuntimeConfig();
    this._tools.clear();
    for (const entry of cfg.tools) {
      this.register(new ToolDescriptor(entry));
    }
    return this;
  }

  register(descriptor) {
    const d = descriptor instanceof ToolDescriptor ? descriptor : new ToolDescriptor(descriptor);
    this._tools.set(d.id, d);
    return d;
  }

  list() {
    return [...this._tools.values()];
  }

  get(id) {
    const tool = this._tools.get(id);
    if (!tool) {
      throw new Error(
        `Unknown tool "${id}". Known tools: ${[...this._tools.keys()].join(", ") || "(none)"}`
      );
    }
    return tool;
  }

  has(id) {
    return this._tools.has(id);
  }
}

export function loadToolRegistry(opts) {
  return new ToolRegistry().discover(opts);
}
