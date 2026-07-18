import test from "node:test";
import assert from "node:assert/strict";
import {
  defaultConfig,
  humanizeProjectName,
  mergeAnswers,
  applySetOverrides,
  tokensFromConfig,
  renderTemplate,
  renderTechStack,
  renderProject,
  renderDesignSystem,
  diffConfig,
} from "../lib/init.mjs";

test("defaultConfig ships a full stack with every rendered field populated", () => {
  const config = defaultConfig();
  assert.equal(config.stack.backend.framework, ".NET 10");
  assert.equal(config.stack.frontend.framework, "Next.js 16");
  assert.equal(config.stack.database, "PostgreSQL 17");
  assert.equal(config.project.name, null); // filled in by the caller, not the default
});

test("humanizeProjectName title-cases a kebab/snake-case directory basename", () => {
  assert.equal(humanizeProjectName("my-cool-app"), "My Cool App");
  assert.equal(humanizeProjectName("my_cool_app"), "My Cool App");
  assert.equal(humanizeProjectName("widget"), "Widget");
});

test("mergeAnswers deep-merges nested fields, later layers winning per leaf", () => {
  const base = { project: { name: "A", version: "0.1.0" }, stack: { database: "Postgres" } };
  const override = { project: { name: "B" }, stack: { auth: "JWT" } };
  const merged = mergeAnswers(base, override);
  assert.deepEqual(merged, {
    project: { name: "B", version: "0.1.0" },
    stack: { database: "Postgres", auth: "JWT" },
  });
});

test("mergeAnswers skips null/undefined layers without clobbering earlier ones", () => {
  const base = { project: { name: "A" } };
  assert.deepEqual(mergeAnswers(base, null, undefined), base);
});

test("applySetOverrides applies dot-path overrides without mutating the input", () => {
  const config = defaultConfig();
  const result = applySetOverrides(config, ["stack.backend.framework=Express", "stack.auth=Session"]);
  assert.equal(result.stack.backend.framework, "Express");
  assert.equal(result.stack.auth, "Session");
  assert.equal(config.stack.backend.framework, ".NET 10", "original config must be untouched");
});

test("applySetOverrides ignores malformed pairs without a '='", () => {
  const config = defaultConfig();
  const result = applySetOverrides(config, ["not-a-pair"]);
  assert.deepEqual(result, config);
});

test("tokensFromConfig produces every TOKEN_FIELDS token, defaulting missing values to empty string", () => {
  const tokens = tokensFromConfig({ project: {}, stack: {} });
  assert.equal(tokens.BACKEND_FRAMEWORK, "");
  assert.equal(tokens.PROJECT_NAME, "");
});

test("renderTemplate substitutes every {{TOKEN}} occurrence", () => {
  const out = renderTemplate("Hello {{NAME}}, again {{NAME}}!", { NAME: "World" });
  assert.equal(out, "Hello World, again World!");
});

test("renderTemplate throws on an unresolved token instead of leaving it literal", () => {
  assert.throws(() => renderTemplate("{{MISSING}}", {}), /Unresolved template token: \{\{MISSING\}\}/);
});

test("renderTechStack/renderProject/renderDesignSystem leave no unresolved {{TOKEN}} markers", () => {
  const config = defaultConfig();
  config.project.name = "Test Project";
  for (const render of [renderTechStack, renderProject, renderDesignSystem]) {
    const out = render(config);
    assert.equal(out.includes("{{"), false, "rendered output must not contain a literal {{ token");
  }
});

test("renderTechStack reflects a non-default stack (not just the .NET defaults)", () => {
  const config = defaultConfig();
  config.project.name = "Widget API";
  config.stack.backend = { language: "Python", framework: "FastAPI" };
  config.stack.database = "SQLite";
  const out = renderTechStack(config);
  assert.match(out, /- FastAPI/);
  assert.match(out, /- Python/);
  assert.match(out, /- SQLite/);
  assert.doesNotMatch(out, /\.NET 10/);
});

test("diffConfig reports only changed TOKEN_FIELDS leaves", () => {
  const a = defaultConfig();
  a.project.name = "X";
  const b = mergeAnswers(a, { stack: { database: "MySQL" } });
  const changes = diffConfig(a, b);
  assert.deepEqual(changes, [
    { field: "stack.database", token: "DATABASE", oldValue: "PostgreSQL 17", newValue: "MySQL" },
  ]);
});

test("diffConfig reports nothing when nothing changed", () => {
  const a = defaultConfig();
  a.project.name = "X";
  assert.deepEqual(diffConfig(a, a), []);
});
