import { promises as fs } from "fs";
import path from "path";
import progress from "progress";

import data from "../src/index.fx.json" with { type: "json" };
import { fileExists, fitLabel } from "./functions.mjs";
import { ASSET_PATH } from "./consts.mjs";

const entries = [];

function parseEntry(entry) {
  if (entry.id) {
    entries.push(entry);
  } else {
    Object.values(entry).forEach(parseEntry);
  }
}

Object.values(data).forEach(parseEntry);

const bar = new progress(":bar :current / :total (:etas)", {
  total: entries.length,
  complete: "\u2588",
  incomplete: "\u2591",
  width: 50,
});

try {
  const nonExistent = [];

  bar.tick(0);
  for (const value of entries) {
    const split = value.src.split("/");
    for (let i = 0; i < 3; i++) split.shift();

    const assetPath = path.join(ASSET_PATH, split.join("/"));

    const exists = await fileExists(assetPath);
    if (!exists) nonExistent.push({ id: value.id, path: split.join("/") });
    bar.tick();
  }

  if (nonExistent.length) {
    console.log("The following non-existent vfx were found:");
    console.log(
      nonExistent
        .map(item => " ".repeat(5) + fitLabel(item.id, 20) + ": " + item.path)
        .join("\n"),
    );
  } else {
    console.log("No problems found.");
  }
} catch (err) {
  console.error(err);
}
