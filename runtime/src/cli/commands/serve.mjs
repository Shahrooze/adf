import { parseArgs } from "../args.mjs";
import * as codes from "../exit-codes.mjs";
import { RestServer } from "../../api/rest-server.mjs";

const HELP = `Usage:
  adf serve [--port N] [--host H]

Starts the REST API (see runtime/src/api/rest-server.mjs for the route
list) over the same Harness instance the CLI uses. Runs until interrupted.`;

export async function serveCommand(harness, argv) {
  const { flags } = parseArgs(argv);
  if (flags.help || flags.h) {
    console.log(HELP);
    return codes.OK;
  }

  const server = new RestServer({
    harness,
    port: flags.port ? Number(flags.port) : undefined,
    host: flags.host,
  });
  await server.listen();
  console.log(`ADF REST API listening on http://${server.host}:${server.port}`);

  await new Promise((resolve) => {
    process.on("SIGINT", resolve);
    process.on("SIGTERM", resolve);
  });
  await server.close();
  return codes.OK;
}
