import { parseArgs } from "../args.mjs";
import { printTable } from "../output.mjs";
import * as codes from "../exit-codes.mjs";

const HELP = `Usage:
  adf plugins list    Show every discovered plugin and whether it loaded.
  adf plugins load    Force a (re-)load of all configured plugin directories.

Plugins are auto-loaded at Harness startup when runtime.config.json's
plugins.autoload is true (the default) — this command is for inspection
and troubleshooting.`;

export async function pluginsCommand(harness, argv) {
  const { flags, positional } = parseArgs(argv);
  if (flags.help || flags.h) {
    console.log(HELP);
    return codes.OK;
  }
  const [sub] = positional;

  if (sub === "load") {
    const results = await harness.loadPlugins();
    printTable(
      results.map((r) => ({ id: r.id, loaded: r.loaded ? "yes" : "no", detail: r.loaded ? r.version ?? "" : r.error })),
      [
        { key: "id", header: "ID" },
        { key: "loaded", header: "LOADED" },
        { key: "detail", header: "DETAIL" },
      ]
    );
    return results.every((r) => r.loaded) ? codes.OK : codes.GENERIC_ERROR;
  }

  const discovered = harness.pluginLoader.discover();
  printTable(
    discovered.map((p) => ({
      id: p.manifest?.id ?? "(invalid)",
      name: p.manifest?.name ?? "",
      version: p.manifest?.version ?? "",
      dir: p.pluginDir,
    })),
    [
      { key: "id", header: "ID" },
      { key: "name", header: "NAME" },
      { key: "version", header: "VERSION" },
      { key: "dir", header: "DIRECTORY" },
    ]
  );
  return codes.OK;
}
