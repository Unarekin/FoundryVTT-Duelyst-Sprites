import { promises as fs } from "fs";
import path from "path";
import ProgressBar from "progress";
import sanitize from "sanitize-filename";
import { ResizeStrategy, defaultPlugins, defaultFormats } from "jimp";
import { createJimp } from "@jimp/core";
import { webp } from "./jimp.webp.mjs";
import plist from "plist";
import ffmpeg from "fluent-ffmpeg";
import { fileExists, randomID } from "./functions.mjs";

const ASSET_PATH = path.join(import.meta.dirname, "..", "src", "assets");

const GENERAL_PATTERN = /(f\d)_(.*?)general(.*).png/g;
const Jimp = createJimp({
  formats: [...defaultFormats, webp],
  plugins: defaultPlugins,
});

function extractFrameCoords(val) {
  const split = val.replaceAll("{", "").replaceAll("}", "").split(",");
  return split.map(item => parseInt(item));
}

export async function parsePlistDirectory(dir, label) {
  const files = (await fs.readdir(dir)).filter(
    file => path.extname(file) === ".plist",
  );

  const progress = new ProgressBar(
    `Parsing ${label}: :bar :current / :total (:etas)`,
    {
      complete: "█",
      incomplete: "░",
      width: 20,
      total: files.length,
      curr: 0,
    },
  );

  progress.tick(0);

  const jsonData = JSON.parse(
    (
      await fs.readFile(
        path.join(import.meta.dirname, "downloads", "carddata.json"),
      )
    ).toString(),
  );

  for (const file of files) {
    const data = jsonData.find(
      item => item.spriteName === path.basename(file, path.extname(file)),
    );
    await parsePlist(path.join(dir, file), data);
    progress.tick();
  }
}

export async function parsePlist(file, data) {
  if (!path.basename(file, path.extname(file)).includes("general")) return;
  const dirName = path.basename(path.dirname(file));
  const outDir = path.join(
    ASSET_PATH,
    dirName,
    sanitize(data?.name ?? path.basename(file, path.extname(file))),
  );

  await fs.mkdir(outDir, { recursive: true });

  const content = (await fs.readFile(file)).toString();
  const parsedList = plist.parse(content);

  const textureFile = parsedList.metadata.textureFileName;
  const frames = Object.entries(parsedList.frames);
  const animations = {};

  const image = await Jimp.read(path.join(path.dirname(file), textureFile));

  for (const [name, frame] of frames) {
    const outPath = path.join(outDir, "frames", name);
    await fs.mkdir(path.join(outDir, "frames"), { recursive: true });
    const clone = image.clone();
    const [x, y, w, h] = extractFrameCoords(frame.frame);

    clone.crop({ x, y, w, h });
    clone.resize({ w: 1024, mode: ResizeStrategy.NEAREST_NEIGHBOR });
    await clone.write(outPath);
  }

  const animationNames = (await fs.readdir(path.join(outDir, "frames"))).reduce(
    (prev, curr) => {
      const split = curr.split("_");
      split.pop();
      const name = split.join("_");
      if (prev.includes(name)) return prev;
      else return [...prev, name];
    },
    [],
  );

  const fileName = path.basename(file, path.extname(file));

  if (fileName.includes("general")) {
    const generalsDir = path.join(path.dirname(path.dirname(file)), "generals");

    // Generate theatre insert and portrait image
    const split = fileName.split("_");
    let theatreName = `general_${split[0]}`;
    let portraitName = `general_portrait_image_${split[0]}`;

    const isThird = fileName.includes("3rd");
    const isAlt = fileName.includes("alt");
    if (isThird) {
      theatreName += "third";
    } else if (isAlt) {
      theatreName += "alt";
      portraitName += "alt";
    }

    theatreName += ".png";
    portraitName += "@2x.png";

    const theatreInsert = await Jimp.read(path.join(generalsDir, theatreName));
    if (theatreInsert) {
      theatreInsert.resize({ w: 1024, mode: ResizeStrategy.NEAREST_NEIGHBOR });
      await theatreInsert.write(path.join(outDir, "theatre-insert.webp"));
    }

    const portrait = await Jimp.read(path.join(generalsDir, portraitName));
    if (portrait) {
      await portrait.write(path.join(outDir, "portrait.webp"));
    }
  }

  for (const animation of animationNames) {
    const filePattern = `${animation}_%03d.png`;
    await new Promise((resolve, reject) => {
      const nameSplit = animation.split("_");
      const name = nameSplit[nameSplit.length - 1];
      ffmpeg(path.join(outDir, "frames", filePattern))
        .inputOptions(["-r 10"])
        .outputOptions(["-vcodec libvpx-vp9", "-an"])
        .save(path.join(outDir, `${name}.webm`))
        .on("error", reject)
        .on("end", resolve)
        .run();
    });
  }

  // Create SA config

  const config = {
    meshAdjustments: {
      enable: false,
      height: 0,
      width: 0,
      x: 0,
      y: 0,
      anchor: {
        x: 0.5,
        y: 0.5,
      },
    },
    animations: animationNames.map(name => {
      const nameSplit = name.split("_");
      const trimmedName = nameSplit[nameSplit.length - 1];
      return {
        id: randomID(),
        src: `modules/duelyst-sprites/assets/${path.basename(path.dirname(file))}/${trimmedName}.webm`,
        loop:
          trimmedName === "run" ||
          trimmedName === "idle" ||
          trimmedName === "breathing",
        name: trimmedName,
      };
    }),
  };

  await fs.writeFile(
    path.join(outDir, `SpriteAnimationConfig.json`),
    JSON.stringify(config),
  );

  await fs.rm(path.join(outDir, "frames"), { recursive: true, force: true });
}
