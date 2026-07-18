import readline from "node:readline/promises";

// The only module in adf-core that imports readline, so every interactive
// touchpoint is easy to find and reason about in one place.
async function ask(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  try {
    return await rl.question(question);
  } finally {
    rl.close();
  }
}

// Prompts "question (y/N): " (or "(Y/n): " when defaultYes) and resolves to
// a boolean. Empty input accepts the default; anything starting with "y"/"n"
// (case-insensitive) is honored, anything else re-reads the default rather
// than looping — this is a single confirmation, not a validated form field.
export async function confirm(question, { defaultYes = false } = {}) {
  const hint = defaultYes ? "Y/n" : "y/N";
  const answer = (await ask(`${question} (${hint}): `)).trim().toLowerCase();
  if (answer === "") return defaultYes;
  if (answer.startsWith("y")) return true;
  if (answer.startsWith("n")) return false;
  return defaultYes;
}

// Prompts "question [default]: " and returns the trimmed answer, falling
// back to `defaultValue` on empty input. This is the shape every init
// wizard question uses.
export async function askWithDefault(question, defaultValue) {
  const suffix = defaultValue ? ` [${defaultValue}]` : "";
  const answer = (await ask(`${question}${suffix}: `)).trim();
  return answer === "" ? defaultValue : answer;
}
