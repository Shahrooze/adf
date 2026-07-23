// Shared argv parsing for every CLI command: --flag value, --flag=value,
// boolean --flag, and repeatable flags (last-wins unless declared
// repeatable). Mirrors adf-core/cli.mjs's own parser so both CLIs feel
// the same to type.
const REPEATABLE = new Set(["context", "consumes", "produces", "stages"]);

export function parseArgs(argv) {
  const flags = {};
  const positional = [];
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg.startsWith("--")) {
      const eq = arg.indexOf("=");
      let key, value;
      if (eq !== -1) {
        key = arg.slice(2, eq);
        value = arg.slice(eq + 1);
      } else {
        key = arg.slice(2);
        const next = argv[i + 1];
        const hasValue = next !== undefined && !next.startsWith("--");
        value = hasValue ? next : true;
        if (hasValue) i++;
      }
      if (REPEATABLE.has(key)) {
        (flags[key] ??= []).push(value);
      } else {
        flags[key] = value;
      }
    } else {
      positional.push(arg);
    }
  }
  return { flags, positional };
}

// "a=1,b=2" -> {a: "1", b: "2"}; also accepts an array of such strings.
export function parseKeyValueList(input) {
  if (!input) return {};
  const items = Array.isArray(input) ? input : [input];
  const out = {};
  for (const item of items) {
    for (const pair of String(item).split(",")) {
      const [k, ...rest] = pair.split("=");
      if (k) out[k.trim()] = rest.join("=").trim();
    }
  }
  return out;
}

export function parseCsv(input) {
  if (!input) return [];
  const items = Array.isArray(input) ? input : [input];
  return items.flatMap((item) => String(item).split(",").map((s) => s.trim()).filter(Boolean));
}
