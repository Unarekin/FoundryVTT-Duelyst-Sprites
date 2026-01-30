import path from "path";
import { promises as fs } from "fs";

import { downloadFile, extractFile } from "./download.mjs";
import { fileExists } from "./functions.mjs";
import { parsePlistDirectory } from "./plist.mjs";

const GITHUB_URL =
  "https://github.com/open-duelyst/duelyst/archive/refs/heads/main.zip";

const CARDDATA_URL =
  "https://raw.githubusercontent.com/kevicency/decklyst/refs/heads/main/src/data/carddata.json";
const DOWNLOAD_DIR = path.join(import.meta.dirname, "./downloads");
const ZIP_PATH = path.join(DOWNLOAD_DIR, path.basename(GITHUB_URL));

try {
  // await fs.rm(path.join(DOWNLOAD_DIR, "duelyst-main"), {
  //   force: true,
  //   recursive: true,
  // });
  // const zipExists = await fileExists(ZIP_PATH);

  // await downloadFile(CARDDATA_URL, DOWNLOAD_DIR);
  // if (process.argv.includes("--force") || !zipExists)
  //   await downloadFile(GITHUB_URL, DOWNLOAD_DIR);

  // await extractFile(ZIP_PATH, DOWNLOAD_DIR);

  await parsePlistDirectory(
    path.join(DOWNLOAD_DIR, "duelyst-main", "units"),
    "Units",
  );
} catch (err) {
  console.error(err);
}
