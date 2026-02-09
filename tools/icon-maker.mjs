import path from "path";
import { promises as fs } from "fs";
import { createJimp } from "./functions.mjs";
import progress from "progress";
import { ASSET_PATH } from "./consts.mjs";
import { GifUtil } from "gifwrap";
import { ResizeStrategy } from "jimp";

const Jimp = createJimp();

import data from "../src/index.json" with { type: "json" };

const dirs = (
  await fs.readdir(path.join(ASSET_PATH, "units"), { withFileTypes: true })
)
  .filter(ent => ent.isDirectory())
  .map(ent => ent.name);

const bar = new progress("[:bar] :current / :total (:etas)", {
  total: dirs.length,
  complete: "=",
  incomplete: " ",
  width: 50,
});

for (const dir of dirs) {
  const iconDir = path.join(ASSET_PATH, "units", dir);

  const gif = await GifUtil.read(path.join(iconDir, "idle.gif"));
  const img = Jimp.fromBitmap(gif.frames[0].bitmap);
  img.autocrop();
  img.scaleToFit({ w: 128, h: 128, mode: ResizeStrategy.NEAREST_NEIGHBOR });

  await img.write(path.join(iconDir, "icon.webp"));

  if (data.units[dir]) {
    data.units[dir].icon = "icon.webp";
  }

  bar.tick();
}

await fs.writeFile(
  path.join(import.meta.dirname, "../src/index.json"),
  JSON.stringify(data, undefined, 2),
);
