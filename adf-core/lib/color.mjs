// Minimal, dependency-free ANSI color helpers. Respects the NO_COLOR
// convention (https://no-color.org) and never colors non-TTY output (piped
// to a file, captured by CI, etc.) — checked live on every call, not
// cached, so tests can toggle process.stdout.isTTY freely.
export function shouldColor() {
  return !process.env.NO_COLOR && Boolean(process.stdout.isTTY);
}

function wrap(code) {
  return (text) => (shouldColor() ? `\x1b[${code}m${text}\x1b[0m` : String(text));
}

export const red = wrap(31);
export const green = wrap(32);
export const yellow = wrap(33);
export const dim = wrap(2);
export const bold = wrap(1);
