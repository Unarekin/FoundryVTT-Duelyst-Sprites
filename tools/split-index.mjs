import path from "path";
import { promises as fs } from "fs";
import { object } from "zod";
import { writeIndex } from "./functions.mjs";
try {
  const config = JSON.parse(
    (
      await fs.readFile(
        path.join(import.meta.dirname, "..", "src", "index.json"),
      )
    ).toString(),
  );
  if (config) await writeIndex(config);
} catch (err) {
  console.log("\n");
  console.error(err);
  process.exit();
}
