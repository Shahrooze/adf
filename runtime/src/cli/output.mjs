// Minimal, dependency-free console output helpers shared by every command.
export function printTable(rows, columns) {
  if (rows.length === 0) {
    console.log("(none)");
    return;
  }
  const widths = columns.map((col) =>
    Math.max(col.header.length, ...rows.map((r) => String(r[col.key] ?? "").length))
  );
  const line = (cells) => cells.map((c, i) => String(c).padEnd(widths[i])).join("  ");
  console.log(line(columns.map((c) => c.header)));
  console.log(line(widths.map((w) => "-".repeat(w))));
  for (const row of rows) {
    console.log(line(columns.map((c) => row[c.key] ?? "")));
  }
}

export function printJson(value) {
  console.log(JSON.stringify(value, null, 2));
}

export function section(title) {
  console.log(`\n${title}\n${"=".repeat(title.length)}`);
}
