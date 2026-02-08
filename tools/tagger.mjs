import { promises as fs } from "fs";
import path from "path";
import data from "../src/index.json" with { type: "json" };
import progress from "progress";

const entries = Object.entries(data.units);

const bar = new progress(":bar :current / :total (:etas)", {
  total: entries.length,
  complete: "=",
  incomplete: " ",
  width: 50,
});
bar.tick(0);
for (const [key, value] of entries) {
  value.tags = [];
  if (value.name.includes("neutral_")) value.tags.push("neutral");
  if (value.name.includes("boss_")) value.tags.push("boss");
  if (value.type) value.tags.push(value.type.toLowerCase());
  if (data.factions[value.factionId])
    value.tags.push(data.factions[value.factionId].abbr.toLowerCase());

  bar.tick();
}

await fs.writeFile(
  path.join(import.meta.dirname, "../src/index.json"),
  JSON.stringify(data, undefined, 2),
);
