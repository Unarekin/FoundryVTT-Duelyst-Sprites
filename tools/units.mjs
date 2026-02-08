import path from "path";
import { promises as fs } from "fs";
import {
  fileExists,
  createJimp,
  extractFrameCoords,
  randomID,
} from "./functions.mjs";

import { ASSET_PATH, DATA } from "./consts.mjs";
import { intToRGBA } from "jimp";
import { GifUtil } from "gifwrap";
import { ResizeStrategy } from "jimp";
import CARD_DATA from "./downloads/carddata.json" with { type: "json" };

const Jimp = createJimp();

/**
 * Called after each plist is processed
 * @param {*} plist
 * @param {*} outputDir
 */
export async function postProcessPlist(plist, baseDir, outputDir) {
  if (!DATA.units) DATA.units = {};
  const textureName = plist.metadata.textureFileName;

  const unitId = path.basename(textureName, path.extname(textureName));

  const CURRENT_DATA = {
    factionId: -1,
    type: "",
    name: unitId,
    description: "",
    tags: [],
  };

  if (unitId.includes("boss)")) CURRENT_DATA.tags.push("boss");
  if (unitId.includes("neutral_")) CURRENT_DATA.tags.push("neutral");

  DATA.units[unitId] = CURRENT_DATA;

  // Sprite animations
  const spriteAnimations = await generateSpriteAnimationConfig(
    path.join(baseDir, textureName),
    plist,
  );
  CURRENT_DATA.spriteAnimations = spriteAnimations;

  // Portrait and theatre insert
  if (textureName.includes("general")) {
    const generalDir = path.resolve(baseDir, "../generals");
    const faction = textureName.split("_")[0];
    const isThird = textureName.includes("3rd");
    const isAlt = textureName.includes("alt");
    let portraitFile = `general_portrait_image_${faction}`;
    if (isAlt) portraitFile += "alt";
    else if (isThird) portraitFile += "third";

    portraitFile += "@2x.png";

    if (await fileExists(path.join(generalDir, portraitFile))) {
      const portrait = await Jimp.read(path.join(generalDir, portraitFile));
      await portrait.write(path.join(outputDir, "portrait.webp"));
      CURRENT_DATA.portrait = "portrait.webp";
    }

    let insertFile = `general_${faction}`;
    if (isAlt) insertFile += "alt";
    else if (isThird) insertFile += "third";

    insertFile += ".png";

    const insertExists = await fileExists(path.join(generalDir, insertFile));
    if (insertExists) {
      const insert = await Jimp.read(path.join(generalDir, insertFile));
      insert.autocrop(1);

      await insert.write(path.join(outputDir, "theatreInsert.webp"));
      CURRENT_DATA.theatreInsert = "theatreInsert.webp";
    }
  }

  const gif = await GifUtil.read(
    path.join(ASSET_PATH, "units", unitId, "idle.gif"),
  );
  const img = Jimp.fromBitmap(gif.frames[0].bitmap);
  img.autocrop();
  img.scaleToFit({ w: 128, h: 128, mode: ResizeStrategy.NEAREST_NEIGHBOR });
  await img.write(path.join(outputDir, "icon.webp"));
  CURRENT_DATA.icon = "icon.webp";

  if (!CURRENT_DATA.portrait) CURRENT_DATA.portrait = "idle.webp";
  if (!CURRENT_DATA.theatreInsert) CURRENT_DATA.theatreInsert = "idle.gif";

  const card = CARD_DATA.find(item => item.spriteName === unitId);
  if (card) {
    CURRENT_DATA.factionId = card.factionId;
    CURRENT_DATA.type = card.cardType.toLowerCase();
    CURRENT_DATA.name = card.name;
    CURRENT_DATA.description = card.description;
  }
  if (CURRENT_DATA.name.startsWith("boss_"))
    CURRENT_DATA.name = CURRENT_DATA.name.substring(5);
  if (CURRENT_DATA.name.startsWith("neutral_"))
    CURRENT_DATA.name = CURRENT_DATA.name.substring(8);

  if (DATA.factions?.[CURRENT_DATA.factionId]) {
    CURRENT_DATA.tags.push(
      DATA.factions[CURRENT_DATA.factionId].abbr.toLowerCase(),
    );
    CURRENT_DATA.tags.push(
      DATA.factions[CURRENT_DATA.factionId].name.toLowerCase(),
    );
  }
  if (CURRENT_DATA.type)
    CURRENT_DATA.tags.push(CURRENT_DATA.type.toLowerCase());
}

async function calculateMeshOffset(imagePath, plist) {
  const originalTexture = await Jimp.read(imagePath);
  const unitName = path.basename(
    plist.metadata.textureFileName,
    path.extname(plist.metadata.textureFileName),
  );

  const idleFrame = plist.frames[`${unitName}_idle_000.png`];
  if (!idleFrame)
    throw new Error(
      "Unable to determine mesh adjustments: No idle frame found",
    );

  const image = originalTexture.clone();
  const [x, y, w, h] = extractFrameCoords(idleFrame.frame);
  image.crop({ x, y, w, h });

  const adjustments = {
    enable: true,
    height: 0,
    width: 0,
    x: 0,
    y: 0,
    anchor: {
      x: 0.5,
      y: 0.5,
    },
  };

  let left = image.width;
  let right = 0;
  let top = image.height;
  let bottom = 0;

  for (let y = 0; y < image.height; y++) {
    for (let x = 0; x < image.width; x++) {
      const color = intToRGBA(image.getPixelColor(x, y));
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
  adjustments.anchor = {
    x: (left + visualWidth / 2) / w,
    y: (top + visualHeight / 2) / h,
  };

  image.autocrop(1);
  if (image.width > image.height) {
    const ratio = image.height / image.width;
    adjustments.width = 100 - image.width;
    adjustments.height = Math.floor(adjustments.width * ratio);
  } else {
    const ratio = image.width / image.height;
    adjustments.height = 100 - image.height;
    adjustments.width = Math.floor(adjustments.height * ratio);
  }

  return adjustments;
}

async function generateSpriteAnimationConfig(imagePath, plist) {
  const meshAdjustments = await calculateMeshOffset(imagePath, plist);
  const textureName = plist.metadata.textureFileName;
  const unitId = path.basename(textureName, path.extname(textureName));
  const animationNames = Object.entries(plist.frames)
    .map(([name]) => {
      const split = name.substring(unitId.length + 1).split("_");
      split.pop();
      return split.join("_");
    })
    .filter((name, i, arr) => arr.indexOf(name) === i);

  const animations = animationNames.map(name => ({
    id: randomID(),
    name,
    src: `modules/duelyst-sprites/assets/units/${unitId}/${name}.webm`,
    loop: ["run", "idle", "breathing", "castloop"].includes(name),
  }));

  return {
    animations,
    meshAdjustments,
  };
}
