import { promises as fs } from "fs";
import path from "path";
// import ProgressBar from "progress";
import MultiProgress from "multi-progress";
import sanitize from "sanitize-filename";
import { ResizeStrategy, defaultPlugins, defaultFormats } from "jimp";
import { createJimp } from "@jimp/core";
import { intToRGBA } from "jimp";
import { GifUtil, GifFrame, BitmapImage } from "gifwrap";
import { webp } from "./jimp.webp.mjs";
import plist from "plist";
import ffmpeg from "fluent-ffmpeg";
import { fileExists, randomID } from "./functions.mjs";
import readline from "readline";

const ASSET_PATH = path.join(import.meta.dirname, "..", "src", "assets");

const GENERAL_PATTERN = /(f\d)_(.*?)general(.*).png/g;
const Jimp = createJimp({
  formats: [...defaultFormats, webp],
  plugins: defaultPlugins,
});

const multiBarFactory = new MultiProgress(process.stderr);

function extractFrameCoords(val) {
  const split = val.replaceAll("{", "").replaceAll("}", "").split(",");
  return split.map(item => parseInt(item));
}

export async function parsePlistDirectory(dir, label) {
  const files = (await fs.readdir(dir)).filter(
    file => path.extname(file) === ".plist",
  );

  const progress = multiBarFactory.newBar(
    `Parsing ${label}: :bar :current / :total (:etas)`,
    {
      complete: "█",
      incomplete: "░",
      width: 20,
      total: files.length,
      curr: 0,
    },
  );

  // const progress = new ProgressBar(
  //   `Parsing ${label}: :bar :current / :total (:etas)`,
  //   {
  //     complete: "█",
  //     incomplete: "░",
  //     width: 20,
  //     total: files.length,
  //     curr: 0,
  //   },
  // );

  progress.tick(0);

  const jsonData = JSON.parse(
    (
      await fs.readFile(
        path.join(import.meta.dirname, "downloads", "carddata.json"),
      )
    ).toString(),
  );

  await fs.mkdir(path.join(ASSET_PATH, path.basename(dir)), {
    recursive: true,
  });

  // output license
  const license =
    (
      await fs.readFile(path.join(import.meta.dirname, "downloads", "LICENSE"))
    )?.toString() ?? "";
  if (license)
    await fs.writeFile(
      path.join(ASSET_PATH, path.basename(dir), "LICENSE"),
      license,
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
  const fileName = path.basename(file, path.extname(file));

  const animationNames = frames.reduce((prev, curr) => {
    const split = curr[0].split("_");
    split.pop();
    const name = split.join("_");
    if (prev.includes(name)) return prev;
    else return [...prev, name];
  }, []);

  const progress = multiBarFactory.newBar(
    `${path.basename(file, path.extname(file))} :bar :current / :total (:etas) :task`,
    {
      complete: "█",
      incomplete: "░",
      task: "Preparing...",
      width: 20,
      total:
        frames.length +
        animationNames.length +
        5 +
        (fileName.includes("general") ? 2 : 0),
      curr: 0,
      clear: true,
    },
  );

  const image = await Jimp.read(path.join(path.dirname(file), textureFile));

  const meshAdjustments = {
    height: 0,
    width: 0,
    x: 0,
    y: 0,
    anchor: {
      x: 0.5,
      y: 0.5,
    },
  };

  const idle = frames.find(([name]) => name.endsWith("_idle_000.png"));
  if (idle) {
    progress.tick(0, { task: "Determining mesh adjustment..." });
    const clone = image.clone();
    const [x, y, w, h] = extractFrameCoords(idle[1].frame);
    clone.crop({ x, y, w, h });

    let left = clone.width;
    let right = 0;
    let top = clone.height;
    let bottom = 0;

    // Determine anchor
    for (let y = 0; y < clone.height; y++) {
      for (let x = 0; x < clone.width; x++) {
        const color = intToRGBA(clone.getPixelColor(x, y));
        if (color.a > 0) {
          if (x < left) left = x;
          if (x > right) right = x;
          if (y < top) top = y;
          if (y > bottom) bottom = y;
        }
      }
    }

    const visualWidth = right - left;
    const visualHeight = bottom - top;
    meshAdjustments.anchor = {
      x: (left + visualWidth / 2) / w,
      y: (top + visualHeight / 2) / h,
    };

    clone.autocrop(1);

    if (clone.width > clone.height) {
      const ratio = clone.height / clone.width;
      meshAdjustments.width = 100 - clone.width;
      meshAdjustments.height = Math.floor(meshAdjustments.width * ratio);
    } else {
      const ratio = clone.width / clone.height;
      meshAdjustments.height = 100 - clone.height;
      meshAdjustments.width = Math.floor(meshAdjustments.height * ratio);
    }
  }

  progress.tick(0, { task: "Extracting frames..." });
  for (const [name, frame] of frames) {
    const outPath = path.join(outDir, "frames", name);
    await fs.mkdir(path.join(outDir, "frames"), { recursive: true });
    const clone = image.clone();
    const [x, y, w, h] = extractFrameCoords(frame.frame);

    clone.crop({ x, y, w, h });
    clone.resize({ w: 1024, mode: ResizeStrategy.NEAREST_NEIGHBOR });
    await clone.write(outPath);

    progress.tick({ task: "Extracting frames..." });
  }

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
    progress.tick();

    const portrait = await Jimp.read(path.join(generalsDir, portraitName));
    if (portrait) {
      await portrait.write(path.join(outDir, "portrait.webp"));
    }
    progress.tick();
  }

  progress.tick(0, { task: "Converting to webm..." });
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
    progress.tick({ task: "Converting to webm..." });
  }

  // Generate idle.webp
  await new Promise((resolve, reject) => {
    ffmpeg(path.join(outDir, "frames", `${fileName}_idle_%03d.png`))
      // .inputOptions(["-r 10", "-loop 0", "-quality 100"])
      .inputOptions(["-r 10"])
      .outputOptions(["-loop 0"])
      .save(path.join(outDir, `idle.webp`))
      .on("error", reject)
      .on("end", resolve)
      .run();
  });
  progress.tick();

  // Generate idle.gif
  const gifFiles = (await fs.readdir(path.join(outDir, "frames"))).filter(
    file => file.includes("_idle_"),
  );
  const gifFrames = [];
  for (const file of gifFiles) {
    const image = await Jimp.read(path.join(outDir, "frames", file));
    const gifFrame = new GifFrame(new BitmapImage(image.bitmap), {
      delayCentisecs: 10,
    });
    gifFrames.push(gifFrame);
  }
  await GifUtil.write(path.join(outDir, "idle.gif"), gifFrames, {
    loops: 0,
  });

  progress.tick();

  // Create SA config
  progress.tick({ task: "Creating Sprite Animations config..." });
  const animConfigExists = await fileExists(
    path.join(outDir, "SpriteAnimationConfig.json"),
  );
  if (!animConfigExists) {
    const config = {
      meshAdjustments,
      animations: animationNames.map(name => {
        const nameSplit = name.split("_");
        const trimmedName = nameSplit[nameSplit.length - 1];
        return {
          id: randomID(),
          src: `modules/duelyst-sprites/assets/${path.basename(path.dirname(file))}/${path.basename(outDir)}/${trimmedName}.webm`,
          loop:
            trimmedName === "run" ||
            trimmedName === "idle" ||
            trimmedName === "breathing" ||
            trimmedName === "castloop",
          name: trimmedName,
        };
      }),
    };

    await fs.writeFile(
      path.join(outDir, `SpriteAnimationConfig.json`),
      JSON.stringify(config),
    );
  }

  progress.tick({ task: "Cleanup..." });
  await fs.rm(path.join(outDir, "frames"), { recursive: true, force: true });
  progress.curr = progress.total;
  progress.tick(0);
  progress.terminate();
}
