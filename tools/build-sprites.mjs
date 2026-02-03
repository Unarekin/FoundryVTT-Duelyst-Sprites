import path from "path";
import { promises as fs } from "fs";

import { downloadFile, extractFile } from "./download.mjs";
import { fileExists } from "./functions.mjs";
import { parsePlistDirectory } from "./plist.mjs";
import { postProcessPlist } from "./units.mjs";
import { ASSET_PATH, DOWNLOAD_DIR, DATA } from "./consts.mjs";

try {
  try {
    const config = JSON.parse(
      (
        await fs.readFile(
          path.join(import.meta.dirname, "..", "src", "index.json"),
        )
      ).toString(),
    );
    if (config) Object.assign(DATA, config);
  } catch (err) {}

  // await fs.rm(path.join(DOWNLOAD_DIR, "duelyst-main"), {
  //   force: true,
  //   recursive: true,
  // });
  // const zipExists = await fileExists(ZIP_PATH);

  // await downloadFile(CARDDATA_URL, DOWNLOAD_DIR);
  // if (process.argv.includes("--force") || !zipExists)
  //   await downloadFile(GITHUB_URL, DOWNLOAD_DIR);

  // await extractFile(ZIP_PATH, DOWNLOAD_DIR);

  console.log("Processing plists...");
  await parsePlistDirectory(
    path.join(DOWNLOAD_DIR, "duelyst-main", "units"),
    postProcessPlist,
  );
} catch (err) {
  console.error(err);
}
