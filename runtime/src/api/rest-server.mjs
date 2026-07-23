// A minimal, dependency-free REST API over node:http. Every route calls
// straight into the same Harness the CLI uses (Harness.workflowEngine,
// Harness.agentRuntime, ...) — this is the "expose APIs so future clients
// can execute ADF" requirement's REST leg; an IDE extension or GitHub
// Action can talk to this instead of shelling out to the CLI, without the
// Harness itself knowing or caring which one is calling.
import http from "node:http";
import { parseWorkflow } from "../workflow/workflow-parser.mjs";
import { renderRunReport } from "../observability/report.mjs";
import { Logger } from "../logging/logger.mjs";

function sendJson(res, status, body) {
  const payload = JSON.stringify(body, null, 2);
  res.writeHead(status, { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(payload) });
  res.end(payload);
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => (data += chunk));
    req.on("end", () => {
      if (!data) return resolve({});
      try {
        resolve(JSON.parse(data));
      } catch (err) {
        reject(new Error(`Invalid JSON body: ${err.message}`));
      }
    });
    req.on("error", reject);
  });
}

// path: "/workflows/:id/run" -> { method, segments: ["workflows", ":id", "run"] }
function compileRoute(method, path, handler) {
  return { method, segments: path.split("/").filter(Boolean), handler };
}

function matchRoute(route, method, pathname) {
  if (route.method !== method) return null;
  const segments = pathname.split("/").filter(Boolean);
  if (segments.length !== route.segments.length) return null;
  const params = {};
  for (let i = 0; i < segments.length; i++) {
    const routeSeg = route.segments[i];
    if (routeSeg.startsWith(":")) {
      params[routeSeg.slice(1)] = decodeURIComponent(segments[i]);
    } else if (routeSeg !== segments[i]) {
      return null;
    }
  }
  return params;
}

function buildRoutes(harness) {
  return [
    compileRoute("GET", "/health", async () => ({ status: 200, body: { ok: true } })),

    compileRoute("GET", "/agents", async () => ({
      status: 200,
      body: harness.agentRegistry.list().map((a) => ({
        id: a.id,
        name: a.name,
        capabilities: a.capabilities,
        tools: a.requiredTools,
        supportedArtifacts: a.supportedArtifacts,
      })),
    })),
    compileRoute("GET", "/agents/:id", async (_req, params) => {
      if (!harness.agentRegistry.has(params.id)) return { status: 404, body: { error: `Unknown agent "${params.id}"` } };
      const a = harness.agentRegistry.get(params.id);
      return { status: 200, body: { id: a.id, name: a.name, description: a.description, capabilities: a.capabilities, tools: a.requiredTools } };
    }),
    compileRoute("POST", "/agents/:id/run", async (req, params, body) => {
      if (!harness.agentRegistry.has(params.id)) return { status: 404, body: { error: `Unknown agent "${params.id}"` } };
      const result = await harness.agentRuntime.run(params.id, {
        featureDir: body.featureDir ?? null,
        consumesPaths: body.consumes ?? null,
        executorName: body.executor ?? null,
        task: { stageId: "api", produces: body.produces ?? [], gateStatus: body.gateStatus ?? null, description: body.description ?? "" },
      });
      return { status: result.status === "completed" ? 200 : 422, body: result };
    }),

    compileRoute("GET", "/tools", async () => ({
      status: 200,
      body: harness.toolRegistry.list().map((t) => ({ id: t.id, name: t.name, description: t.description, permissions: t.permissions })),
    })),

    compileRoute("GET", "/workflows", async () => ({
      status: 200,
      body: harness.workflowRegistry.list().map((w) => ({ id: w.raw.id, name: w.raw.name, stages: (w.raw.stages ?? []).length })),
    })),
    compileRoute("GET", "/workflows/:id", async (_req, params) => {
      if (!harness.workflowRegistry.has(params.id)) return { status: 404, body: { error: `Unknown workflow "${params.id}"` } };
      const def = parseWorkflow(harness.workflowRegistry.get(params.id).raw);
      return { status: 200, body: def };
    }),
    compileRoute("POST", "/workflows/:id/run", async (_req, params, body) => {
      if (!harness.workflowRegistry.has(params.id)) return { status: 404, body: { error: `Unknown workflow "${params.id}"` } };
      const result = await harness.workflowEngine.run(params.id, {
        runId: body.runId ?? null,
        featureDir: body.featureDir ?? null,
        context: body.context ?? {},
      });
      return { status: result.status === "completed" ? 200 : 422, body: result };
    }),

    compileRoute("GET", "/runs", async () => ({
      status: 200,
      body: harness.checkpointStore.list().map((id) => harness.checkpointStore.load(id)),
    })),
    compileRoute("GET", "/runs/:id", async (_req, params) => {
      const checkpoint = harness.checkpointStore.load(params.id);
      if (!checkpoint) return { status: 404, body: { error: `Unknown run "${params.id}"` } };
      return { status: 200, body: checkpoint };
    }),
    compileRoute("GET", "/runs/:id/report", async (_req, params) => {
      const checkpoint = harness.checkpointStore.load(params.id);
      if (!checkpoint) return { status: 404, body: { error: `Unknown run "${params.id}"` } };
      const def = parseWorkflow(harness.workflowRegistry.get(checkpoint.workflowId).raw);
      const logEntries = Logger.readRun(params.id, harness.logger.logDir);
      return { status: 200, headers: { "Content-Type": "text/markdown" }, raw: renderRunReport({ workflowDefinition: def, runResult: checkpoint, logEntries }) };
    }),
    compileRoute("GET", "/runs/:id/logs", async (_req, params) => ({ status: 200, body: Logger.readRun(params.id, harness.logger.logDir) })),
    compileRoute("POST", "/runs/:id/pause", async (_req, params) => {
      harness.workflowEngine.pause(params.id);
      return { status: 202, body: { ok: true } };
    }),
    compileRoute("POST", "/runs/:id/resume", async (_req, params) => {
      if (harness.workflowEngine.getRun(params.id)) {
        harness.workflowEngine.resume(params.id);
        return { status: 202, body: { ok: true } };
      }
      const checkpoint = harness.checkpointStore.load(params.id);
      if (!checkpoint) return { status: 404, body: { error: `Unknown run "${params.id}"` } };
      const result = await harness.workflowEngine.run(checkpoint.workflowId, { resumeFromRunId: params.id });
      return { status: result.status === "completed" ? 200 : 422, body: result };
    }),
    compileRoute("POST", "/runs/:id/cancel", async (_req, params) => {
      harness.workflowEngine.cancel(params.id);
      return { status: 202, body: { ok: true } };
    }),
    compileRoute("POST", "/runs/:id/retry", async (_req, params) => {
      const checkpoint = harness.checkpointStore.load(params.id);
      if (!checkpoint) return { status: 404, body: { error: `Unknown run "${params.id}"` } };
      if (checkpoint.status !== "failed") return { status: 409, body: { error: `Run "${params.id}" is "${checkpoint.status}", not "failed"` } };
      const result = await harness.workflowEngine.run(checkpoint.workflowId, { resumeFromRunId: params.id });
      return { status: result.status === "completed" ? 200 : 422, body: result };
    }),

    compileRoute("GET", "/artifacts", async (req) => {
      const url = new URL(req.url, "http://localhost");
      return {
        status: 200,
        body: harness.artifactManager.list({
          type: url.searchParams.get("type"),
          status: url.searchParams.get("status"),
          workflowRunId: url.searchParams.get("workflowRunId"),
        }),
      };
    }),
    compileRoute("GET", "/artifacts/:id", async (_req, params) => {
      if (!harness.artifactManager.has(params.id)) return { status: 404, body: { error: `Unknown artifact "${params.id}"` } };
      return { status: 200, body: harness.artifactManager.get(params.id) };
    }),

    compileRoute("POST", "/validate", async (_req, _params, body) => {
      const result = await harness.validationPipeline.run({ stages: body.stages ?? null });
      return { status: result.canContinue ? 200 : 422, body: result };
    }),

    compileRoute("GET", "/plugins", async () => ({ status: 200, body: harness.pluginLoader.discover().map((p) => p.manifest) })),
  ];
}

export class RestServer {
  constructor({ harness, port, host }) {
    this.harness = harness;
    this.port = port ?? harness.config.api.port;
    this.host = host ?? harness.config.api.host;
    this.routes = buildRoutes(harness);
    this.server = http.createServer((req, res) => this._handle(req, res));
  }

  async _handle(req, res) {
    const url = new URL(req.url, "http://localhost");
    let body = {};
    if (req.method === "POST" || req.method === "PUT") {
      try {
        body = await readJsonBody(req);
      } catch (err) {
        return sendJson(res, 400, { error: err.message });
      }
    }

    for (const route of this.routes) {
      const params = matchRoute(route, req.method, url.pathname);
      if (!params) continue;
      try {
        const result = await route.handler(req, params, body);
        if (result.raw !== undefined) {
          res.writeHead(result.status, result.headers ?? { "Content-Type": "text/plain" });
          res.end(result.raw);
        } else {
          sendJson(res, result.status, result.body);
        }
      } catch (err) {
        this.harness.logger?.error?.(`REST API error on ${req.method} ${url.pathname}: ${err.message}`, { error: err.message });
        sendJson(res, 500, { error: err.message });
      }
      return;
    }
    sendJson(res, 404, { error: `No route for ${req.method} ${url.pathname}` });
  }

  listen() {
    return new Promise((resolve) => {
      this.server.listen(this.port, this.host, () => resolve(this));
    });
  }

  close() {
    return new Promise((resolve, reject) => {
      this.server.close((err) => (err ? reject(err) : resolve()));
      // http.Server.close() only stops accepting new connections — it
      // waits indefinitely for already-open keep-alive sockets to end on
      // their own. Force them shut so callers (tests, `adf serve` on
      // SIGINT) get a close() that actually resolves.
      this.server.closeAllConnections?.();
    });
  }
}
