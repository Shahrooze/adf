# Examples

All of these are real, runnable commands against this repository as it
stands — none require any external service or API key (they use the
`mock` executor by default).

## Run the canonical sequential pipeline

```sh
./adf run feature-development --feature-dir features/my-feature --report
./adf status --report          # most recent run's full execution report
```

## Run the parallel/conditional example

```sh
./adf run parallel-development --feature-dir features/my-feature
./adf workflow show parallel-development   # see the stage graph
```

## Run one agent in isolation

```sh
./adf agent run backend-agent \
  --feature-dir features/my-feature \
  --consumes architecture.md \
  --produces backend-implementation-report.md \
  --task "Implement the login API described in architecture.md"
```

## Inspect a run

```sh
./adf status <run-id>
./adf logs <run-id>
./adf logs <run-id> --metrics
./adf artifacts --workflow-run-id <run-id>
```

## Recover from a failure

```sh
./adf run feature-development --feature-dir features/x --run-id my-run
# ... a stage fails ...
./adf retry my-run              # re-runs the failed stage from checkpoint
```

## Pause and resume programmatically

Pause/resume/cancel aren't CLI-interactive today (there's no long-running
CLI process to send them to mid-run) — they're reachable from the REST API
or by embedding the Harness directly:

```sh
./adf serve &
curl -X POST http://127.0.0.1:4870/workflows/feature-development/run \
  -d '{"featureDir": "features/x", "runId": "my-run"}' &
sleep 1
curl -X POST http://127.0.0.1:4870/runs/my-run/pause
curl -X POST http://127.0.0.1:4870/runs/my-run/resume
```

```js
import { Harness } from "./runtime/src/harness.mjs";
const harness = new Harness();
const runPromise = harness.workflowEngine.run("feature-development", { featureDir: "features/x", runId: "my-run" });
// later, from any other code path holding the same harness:
harness.workflowEngine.pause("my-run");
harness.workflowEngine.resume("my-run");
await runPromise;
```

## Run the Validation Pipeline

```sh
./adf validate                          # every configured step, fail-fast
./adf validate --stages unit-tests       # just one
./adf validate --continue-on-failure     # run every step regardless, report all
```

## Write and load a plugin

```sh
cp -r runtime/examples/plugins/hello-tool-plugin plugins/
./adf plugins list
node -e '
import("./runtime/src/harness.mjs").then(async ({Harness}) => {
  const h = new Harness();
  await h.loadPlugins();
  console.log(await h.toolRuntime.execute("hello", { name: "ADF" }, { agentId: "demo" }));
});
'
```

See `docs/PLUGINS.md` for the full authoring reference.

## Use the REST API

```sh
./adf serve --port 4870 &
curl http://127.0.0.1:4870/agents | jq '.[].id'
curl -X POST http://127.0.0.1:4870/workflows/parallel-development/run \
  -H 'content-type: application/json' \
  -d '{"featureDir": "features/rest-demo"}'
curl http://127.0.0.1:4870/runs
```

## Use a real AI CLI instead of the mock executor

```json
// runtime.config.json
{ "runtime": { "defaultExecutor": "cli-adapter", "executors": { "cli-adapter": { "command": "claude", "args": ["-p"] } } } }
```

```sh
./adf run feature-development --feature-dir features/real-run
```

Every agent execution now spawns `claude -p`, feeding it the agent's
`system.md` + `instructions.md` + task + assembled context over stdin.
