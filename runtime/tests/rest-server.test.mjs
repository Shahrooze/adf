import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { Harness } from "../src/harness.mjs";
import { RestServer } from "../src/api/rest-server.mjs";
import { REPO_ROOT } from "../src/config/paths.mjs";

async function buildServer() {
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "adf-rest-"));
  const harness = new Harness();
  harness.checkpointStore.dir = path.join(tmpRoot, "checkpoints");
  fs.mkdirSync(harness.checkpointStore.dir, { recursive: true });
  harness.logger.logDir = path.join(tmpRoot, "logs");
  fs.mkdirSync(harness.logger.logDir, { recursive: true });
  harness.artifactManager.stateDir = path.join(tmpRoot, "artifacts");
  harness.artifactManager.historyDir = path.join(harness.artifactManager.stateDir, "history");
  fs.mkdirSync(harness.artifactManager.historyDir, { recursive: true });
  harness.artifactManager.indexPath = path.join(harness.artifactManager.stateDir, "index.json");
  harness.artifactManager._records = new Map();

  const server = new RestServer({ harness, port: 0, host: "127.0.0.1" });
  await server.listen();
  const port = server.server.address().port;
  return { server, harness, tmpRoot, base: `http://127.0.0.1:${port}` };
}

async function getJson(base, p) {
  const r = await fetch(base + p);
  return { status: r.status, body: await r.json() };
}
async function postJson(base, p, body) {
  const r = await fetch(base + p, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body ?? {}) });
  return { status: r.status, body: await r.json() };
}

test("REST /health returns ok", async () => {
  const { server, base } = await buildServer();
  const res = await getJson(base, "/health");
  assert.equal(res.status, 200);
  assert.equal(res.body.ok, true);
  await server.close();
});

test("REST GET /agents and /agents/:id", async () => {
  const { server, base } = await buildServer();
  const list = await getJson(base, "/agents");
  assert.equal(list.status, 200);
  assert.ok(list.body.length >= 12);

  const one = await getJson(base, "/agents/backend-agent");
  assert.equal(one.status, 200);
  assert.equal(one.body.id, "backend-agent");

  const missing = await getJson(base, "/agents/does-not-exist");
  assert.equal(missing.status, 404);
  await server.close();
});

test("REST GET /workflows/:id returns the normalized stage graph", async () => {
  const { server, base } = await buildServer();
  const res = await getJson(base, "/workflows/parallel-development");
  assert.equal(res.status, 200);
  assert.equal(res.body.id, "parallel-development");
  const implementation = res.body.stages.find((s) => s.id === "implementation");
  assert.equal(implementation.type, "parallel");
  await server.close();
});

test("REST POST /workflows/:id/run executes a workflow end to end", async () => {
  const { server, base, tmpRoot } = await buildServer();
  const featureDir = path.relative(REPO_ROOT, path.join(tmpRoot, "features", "rest-demo"));
  const res = await postJson(base, "/workflows/parallel-development/run", { featureDir });
  assert.equal(res.status, 200);
  assert.equal(res.body.status, "completed");
  assert.ok(fs.existsSync(path.join(REPO_ROOT, featureDir, "specification.md")));

  const runsList = await getJson(base, "/runs");
  assert.equal(runsList.body.length, 1);

  const runDetail = await getJson(base, `/runs/${res.body.id}`);
  assert.equal(runDetail.body.status, "completed");

  const logs = await getJson(base, `/runs/${res.body.id}/logs`);
  assert.ok(logs.body.length > 0);

  const reportRes = await fetch(base + `/runs/${res.body.id}/report`);
  const reportText = await reportRes.text();
  assert.match(reportText, /```mermaid/);

  fs.rmSync(path.join(REPO_ROOT, featureDir), { recursive: true, force: true });
  await server.close();
});

test("REST POST /workflows/:id/run 404s for an unknown workflow", async () => {
  const { server, base } = await buildServer();
  const res = await postJson(base, "/workflows/not-real/run", {});
  assert.equal(res.status, 404);
  await server.close();
});

test("REST POST /runs/:id/retry rejects a run that is not failed", async () => {
  const { server, base, tmpRoot } = await buildServer();
  const featureDir = path.relative(REPO_ROOT, path.join(tmpRoot, "features", "rest-retry-demo"));
  const runRes = await postJson(base, "/workflows/feature-development/run", { featureDir });
  const retryRes = await postJson(base, `/runs/${runRes.body.id}/retry`, {});
  assert.equal(retryRes.status, 409);
  fs.rmSync(path.join(REPO_ROOT, featureDir), { recursive: true, force: true });
  await server.close();
});

test("REST GET /artifacts filters by type", async () => {
  const { server, base, tmpRoot } = await buildServer();
  const featureDir = path.relative(REPO_ROOT, path.join(tmpRoot, "features", "rest-artifacts-demo"));
  await postJson(base, "/workflows/feature-development/run", { featureDir });

  const filtered = await getJson(base, "/artifacts?type=specification");
  assert.equal(filtered.status, 200);
  assert.ok(filtered.body.length >= 1);
  assert.ok(filtered.body.every((a) => a.type === "specification"));

  fs.rmSync(path.join(REPO_ROOT, featureDir), { recursive: true, force: true });
  await server.close();
});

test("REST POST /validate runs the validation pipeline", async () => {
  const { server, base, harness } = await buildServer();
  harness.validationPipeline.stepsConfig = { "rest-step": { command: "echo ok" } };
  const res = await postJson(base, "/validate", { stages: ["rest-step"] });
  assert.equal(res.status, 200);
  assert.equal(res.body.passed, true);
  await server.close();
});

test("REST returns 404 for an unrouted path", async () => {
  const { server, base } = await buildServer();
  const res = await getJson(base, "/nope/not/a/route");
  assert.equal(res.status, 404);
  await server.close();
});
