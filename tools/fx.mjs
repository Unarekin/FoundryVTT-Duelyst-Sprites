import { ASSET_PATH, DATA } from "./consts.mjs";
import path from "path";

/**
 * Called after each plist is processed
 * @param {*} plist
 * @param {*} outputDir
 */
export async function postProcessPlist(plist, baseDir, outputDir) {
  if (!DATA.fx) DATA.fx = {};
  const textureName = plist.metadata.textureFileName;

  const fileName = path.basename(textureName, path.extname(textureName));

  let fxId = fileName;
  if (fxId.startsWith("fx_")) fxId = fxId.substring(3);
  if (/f\d_fx_/.test(fxId)) fxId = fxId.substring(6);

  const CURRENT_DATA = {
    id: fxId,
    src: path.join(
      `modules/duelyst-sprites/assets/fx`,
      fileName,
      `${fileName}.webm`,
    ),
  };

  DATA.fx[fxId] = CURRENT_DATA;
}
