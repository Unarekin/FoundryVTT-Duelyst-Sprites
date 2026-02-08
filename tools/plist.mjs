import { promises as fs } from "fs";
import { ASSET_PATH, DATA, DOWNLOAD_DIR } from "./consts.mjs";
import path from "path";
import cliProgress from "cli-progress";
import PList from "plist";
import { convertFfmpeg, fileExists, fitLabel } from "./functions.mjs";
import { ResizeStrategy } from "jimp";
import { GifUtil, GifFrame, BitmapImage } from "gifwrap";
import { extractFrameCoords, createJimp } from "./functions.mjs";

const Jimp = createJimp();

const FILE_DISPLAY_LENGTH = 20;

export async function parsePlistDirectory(dir, postFunc) {
  try {
    const outputDir = path.join(ASSET_PATH, path.basename(dir));

    const files = (await fs.readdir(dir)).filter(
      file => path.extname(file) === ".plist",
    );

    const multibar = new cliProgress.MultiBar(
      {
        clearOnComplete: true,
        stopOnComplete: true,
        hideCursor: true,
        barCompleteChar: "\u2588",
        barIncompleteChar: "\u2591",
        etaBuffer: 1000,
        format: `{file} {bar} {task} {value}/{total} | elapsed: {duration_formatted} eta: {eta_formatted}`,
        // format: "{bar} | {filename} | {value}/{total}",
      },
      cliProgress.Presets.shades_grey,
    );

    const overallBar = multibar.create(files.length + 1, 0, {
      task: fitLabel("Preparing...", 20),
      file: fitLabel(path.basename(dir), FILE_DISPLAY_LENGTH),
    });

    if (process.argv.includes("--force")) {
      // Clean dir
      await fs.rm(outputDir, { recursive: true, force: true });
      await fs.mkdir(outputDir, { recursive: true });
    }

    const license = (
      await fs.readFile(path.join(DOWNLOAD_DIR, "LICENSE"))
    ).toString();
    await fs.writeFile(path.join(outputDir, "LICENSE"), license);

    overallBar.increment({ task: fitLabel("Processing...", 20) });
    for (const file of files) {
      await parsePlist(
        path.join(dir, file),
        outputDir,
        postFunc,
        multibar,
        overallBar,
      );

      await fs.writeFile(
        path.join(import.meta.dirname, "..", "src", "index.json"),
        JSON.stringify(DATA, null, 2),
      );

      overallBar.increment();
    }
    overallBar.update({
      task: fitLabel("✓ Done!", FILE_DISPLAY_LENGTH),
    });
  } catch (err) {
    if (overallBar) overallBar.stop();
    console.error(err);
  }
}

async function parsePlist(file, outDir, postFunc, multiBar, overallBar) {
  const fileName = path.basename(file, path.extname(file));
  const actualOutputPath = path.join(outDir, fileName);
  let fileBar;
  if (
    process.argv.includes("--force") ||
    !(await fileExists(actualOutputPath))
  ) {
    const plist = PList.parse((await fs.readFile(file)).toString());

    const animationFrames = Object.entries(plist.frames);

    const animationNames = Object.keys(plist.frames)
      .map(name => {
        const fileName = path.basename(file, path.extname(file));
        const split = name.replace(`${fileName}_`, "").split("_");
        split.pop();
        return split.join("_");
      })
      .filter((name, i, arr) => arr.indexOf(name) === i);

    fileBar = multiBar.create(
      animationFrames.length + animationNames.length + 3,
      0,
      {
        file: fitLabel(fileName, FILE_DISPLAY_LENGTH),
        task: fitLabel("Preparing...", 20),
      },
    );

    fileBar.update({
      task: fitLabel("Loading texture...", FILE_DISPLAY_LENGTH),
    });
    const textureFile = plist.metadata.textureFileName;
    const spriteSheet = await Jimp.read(
      path.join(path.dirname(file), textureFile),
    );

    fileBar.update({ task: fitLabel("Slicing...", FILE_DISPLAY_LENGTH) });

    const frames = Object.entries(plist.frames);

    await fs.mkdir(path.join(actualOutputPath, "frames"), { recursive: true });

    for (const [name, frame] of frames) {
      const clone = spriteSheet.clone();
      const [x, y, w, h] = extractFrameCoords(frame.frame);
      clone.crop({ x, y, w, h });
      clone.resize({ w: 1024, mode: ResizeStrategy.NEAREST_NEIGHBOR });
      const outPath = path.join(actualOutputPath, "frames", name);
      await clone.write(outPath);

      fileBar.increment();
    }

    fileBar.update({ task: "Creating idle.webp..." });
    await convertFfmpeg(
      path.join(actualOutputPath, "frames", `${fileName}_idle_%03d.png`),
      path.join(actualOutputPath, "idle.webp"),
      ["-r 10"],
      ["-loop 0"],
    );
    fileBar.increment();

    fileBar.update({ task: "Creating idle.gif..." });
    const gifFiles = (
      await fs.readdir(path.join(actualOutputPath, "frames"))
    ).filter(file => file.includes("_idle_"));
    const gifFrames = [];
    for (const file of gifFiles) {
      const image = await Jimp.read(
        path.join(actualOutputPath, "frames", file),
      );
      const gifFrame = new GifFrame(new BitmapImage(image.bitmap), {
        delayCentisecs: 10,
      });
      gifFrames.push(gifFrame);
    }
    await GifUtil.write(path.join(actualOutputPath, "idle.gif"), gifFrames, {
      loops: 0,
    });
    fileBar.increment();

    fileBar.update({ task: "Converting WEBM..." });
    for (const animation of animationNames) {
      await convertFfmpeg(
        path.join(
          actualOutputPath,
          "frames",
          `${path.basename(file, path.extname(file))}_${animation}_%03d.png`,
        ),
        path.join(actualOutputPath, `${animation}.webm`),
        ["-r 10", "-hwaccel auto"],
        ["-vcodec libvpx-vp9"],
      );

      fileBar.increment();
    }
  }
  if (postFunc) await postFunc(plist, path.dirname(file), actualOutputPath);

  if (fileBar) fileBar.update({ task: "Cleanup..." });
  await fs.rm(path.join(actualOutputPath, "frames"), {
    recursive: true,
    force: true,
  });

  if (fileBar) {
    fileBar.update({
      task: fitLabel("✓ Done!", FILE_DISPLAY_LENGTH),
    });
    multiBar.remove(fileBar);
  }
}
