// HTTP tool: outbound requests via the Node 18+ built-in fetch. No
// dependency on axios/node-fetch/etc — keeps the Harness zero-dependency.
export const metadata = { id: "http", actions: ["request"] };

export async function execute(args, ctx) {
  const { url, method = "GET", headers = {}, body = null, timeoutMs = 20000 } = args;
  if (!url) throw new Error("http tool requires args.url");

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      method,
      headers,
      body: body ? (typeof body === "string" ? body : JSON.stringify(body)) : undefined,
      signal: ctx.signal ?? controller.signal,
    });
    const text = await response.text();
    let parsed = text;
    try {
      parsed = JSON.parse(text);
    } catch {
      // leave as text
    }
    return {
      status: response.status,
      ok: response.ok,
      headers: Object.fromEntries(response.headers.entries()),
      body: parsed,
    };
  } finally {
    clearTimeout(timer);
  }
}
