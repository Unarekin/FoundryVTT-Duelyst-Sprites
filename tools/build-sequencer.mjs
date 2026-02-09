import path from "path";
import { promises as fs } from "fs";

function parseEntry(entry) {
  if (entry.id && entry.src) return entry.src;
  const data = {};

  for (const [key, value] of Object.entries(entry))
    data[key] = parseEntry(value);
  return data;
}

try {
  const config = JSON.parse(
    (
      await fs.readFile(
        path.join(import.meta.dirname, "..", "src", "index.fx.json"),
      )
    ).toString(),
  );

  const parsed = {};
  for (const [key, value] of Object.entries(config)) {
    parsed[key] = parseEntry(value);
  }

  await fs.writeFile(
    path.join(import.meta.dirname, "..", "src", "sequencer.json"),
    JSON.stringify(parsed, null, 2),
  );
} catch (err) {
  console.error(err);
}
