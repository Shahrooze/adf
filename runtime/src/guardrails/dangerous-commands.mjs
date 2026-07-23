// A hard safety net independent of any per-tool permission setting: a
// command matching one of these patterns is refused even if the acting
// agent has "allow" for the tool that would run it. Patterns come from
// config/guardrails.json so a project can extend the list without
// touching Harness source.
export class DangerousCommandGuard {
  constructor(patterns = []) {
    this.regexes = patterns.map((p) => new RegExp(p, "i"));
  }

  check(command) {
    if (!command || typeof command !== "string") return { dangerous: false };
    for (const re of this.regexes) {
      if (re.test(command)) {
        return { dangerous: true, pattern: re.source };
      }
    }
    return { dangerous: false };
  }
}
