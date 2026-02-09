import { promises as fs } from "fs";
import { ASSET_PATH, DATA, DOWNLOAD_DIR } from "./consts.mjs";
import path from "path";
import cliProgress from "cli-progress";
import PList from "plist";
import {
  convertFfmpeg,
  fileExists,
  fitLabel,
  writeIndex,
} from "./functions.mjs";
import { Jimp, ResizeStrategy } from "jimp";
import { extractFrameCoords, createJimp } from "./functions.mjs";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";

const argv = yargs(hideBin(process.argv)).parse();

try {
  if (!argv.plist) throw new Error("No plist specified");
  if (!argv.outDir) throw new Error("outDir not specified");
  try {
    const indexFiles = ["fx", "units", "factions"];
    for (const file of indexFiles) {
      const config = JSON.parse(
        (
          await fs.readFile(
            path.join(import.meta.dirname, "..", "src", `index.${file}.json`),
          )
        ).toString(),
      );
      if (config) DATA[file] = config;
    }
  } catch (err) {}

  const outPath = path.resolve(argv.outDir);
  const plistDir = path.resolve(argv.plist);

  await fs.mkdir(outPath, { recursive: true });
  const plist = PList.parse((await fs.readFile(plistDir)).toString());

  const animationFrames = Object.entries(plist.frames);
  const bar = new cliProgress.SingleBar({
    clearOnComplete: true,
    stopOnComplete: true,
    hideCursor: true,
    barCompleteChar: "\u2588",
    barIncompleteChar: "\u2591",
    etaBuffer: 1000,
    format: `{file} {bar} {task} {value}/{total} | elapsed: {duration_formatted} eta: {eta_formatted}`,
  });

  const animationNames = Object.keys(plist.frames)
    .map(name => {
      let animationName = name;
      if (animationName.startsWith("fx_") || animationName.startsWith("f6_"))
        animationName = animationName.substring(3);
      const reg = /_(\d.*?).png$/gi;
      if (reg.test(animationName)) {
        animationName = animationName.substring(0, animationName.length - 8);
      }

      return animationName;
    })
    .filter((name, i, arr) => arr.indexOf(name) === i);

  bar.start(animationFrames.length + animationNames.length + 2, 0, {
    task: `Extracting frames`,
    file: path.basename(plistDir, path.extname(plistDir)),
  });

  const textureFile = plist.metadata.textureFileName;

  const spriteSheet = await Jimp.read(
    path.join(path.dirname(plistDir), textureFile),
  );

  await fs.mkdir(path.join(outPath, "frames"), { recursive: true });
  for (const [name, frame] of animationFrames) {
    const clone = spriteSheet.clone();
    const [x, y, w, h] = extractFrameCoords(frame.frame);
    clone.crop({ x, y, w, h });
    clone.resize({ w: 1024, mode: ResizeStrategy.NEAREST_NEIGHBOR });
    await clone.write(path.join(outPath, "frames", name));

    bar.increment();
  }

  bar.update({ task: "Converting WEBM..." });
  for (const name of animationNames) {
    const reg = /^f(.*?)\_/;
    let framePattern = `${name}_%03d.png`;

    if (reg.test(path.basename(textureFile)))
      framePattern = textureFile.substring(0, 3) + framePattern;

    await convertFfmpeg(
      path.join(outPath, "frames", framePattern),
      path.join(outPath, `${name}.webm`),
      ["-framerate 10", "-hwaccel auto"],
      ["-vcodec libvpx-vp9", "-lossless 1", "-pix_fmt yuva420p", "-an"],
    );

    bar.increment();
  }

  bar.update({ task: "Cleanup" });
  await fs.rm(path.join(outPath, "frames"), { force: true, recursive: true });

  bar.update({ task: "Adding to index" });

  if (animationNames.length > 1) {
    const CURRENT_DATA = Object.fromEntries(
      animationNames.map(name => {
        let actualName = name;
        if (actualName.startsWith("fx_")) actualName = actualName.substring(3);
        return [
          actualName,
          {
            id: actualName,
            src: `modules/duelyst-sprites/assets/fx/${path.basename(plistDir, path.extname(plistDir))}/${name}.webm`,
          },
        ];
      }),
    );

    DATA.fx[path.basename(plistDir, path.extname(plistDir))] = CURRENT_DATA;
  } else {
    let animationName = path.basename(plistDir, path.extname(plistDir));
    if (animationName.startsWith("fx_"))
      animationName = animationName.substring(3);
    const CURRENT_DATA = {
      id: animationName,
      src: path.join(outPath, `${animationName}.webm`),
    };
    DATA.fx[animationName] = CURRENT_DATA;
  }

  bar.increment(1, { task: "Writing index" });
  await writeIndex(DATA);

  bar.stop();
} catch (err) {
  console.log("\n");
  console.error(err);
  process.exit();
}
