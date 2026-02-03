import path from "path";

export const ASSET_PATH = path.join(import.meta.dirname, "..", "src", "assets");
export const GITHUB_URL =
  "https://github.com/open-duelyst/duelyst/archive/refs/heads/main.zip";

export const CARDDATA_URL =
  "https://raw.githubusercontent.com/kevicency/decklyst/refs/heads/main/src/data/carddata.json";
export const DOWNLOAD_DIR = path.join(import.meta.dirname, "./downloads");
export const ZIP_PATH = path.join(DOWNLOAD_DIR, path.basename(GITHUB_URL));

export const DATA = {};
