import axios from "axios";
import unzipper from "unzipper";
import { promises as fs } from "fs";
import origFS from "fs";

import path from "path";
import ProgressBar from "progress";
import yoctoSpinner from "yocto-spinner";

import { formatBytes } from "./functions.mjs";

const PROGRESS_COMPLETE = "█";
const PROGRESS_INCOMPLETE = "░";

async function writeFile(entry, destination) {
  return new Promise((resolve, reject) => {
    entry
      .stream()
      .pipe(origFS.createWriteStream(destination))
      .on("error", reject)
      .on("close", resolve);
  });
}

export async function downloadFile(url, destination) {
  return new Promise(async (resolve, reject) => {
    try {
      await fs.mkdir(destination, { recursive: true });
      const headResponse = await axios.head(url);
      const fileSize = headResponse.headers["Content-Length"];

      const OUT_PATH = path.join(destination, path.basename(url));

      let progress;
      let spinner;

      if (fileSize) {
        progress = new ProgressBar(
          "Downloading [:bar] :downloadedBytes/:totalBytes (:etas)",
          {
            curr: 0,
            total: fileSize,
            incomplete: PROGRESS_INCOMPLETE,
            complete: PROGRESS_COMPLETE,
            downloadedBytes: formatBytes(0),
            totalBytes: formatBytes(fileSize),
          },
        );
      } else {
        spinner = yoctoSpinner({
          text: `Downloading: ${formatBytes(0)}`,
        }).start();
      }

      const response = await axios({
        method: "get",
        url,
        responseType: "stream",
        onDownloadProgress: data => {
          if (progress) {
            progress.tick(data.bytes, {
              downloadedBytes: formatBytes(data.loaded),
              totalBytes: formatBytes(fileSIze),
            });
          }
          if (spinner)
            spinner.text = `Downloading: ${formatBytes(data.loaded)}`;
        },
      });
      response.data.pipe(origFS.createWriteStream(OUT_PATH)).on("close", () => {
        if (progress) {
          progress.curr = progress.total;
          progress.tick(0);
          console.log("\n");
        }
        if (spinner) {
          spinner.success(`Downloaded.`);
        }
        resolve(OUT_PATH);
      });
    } catch (err) {
      reject(err);
    }
  });
}

export async function extractFile(file, destination) {
  const directory = await unzipper.Open.file(file);

  const files = directory.files.filter(file =>
    file.path.startsWith("duelyst-main/app/resources"),
  );

  const totalData = files.reduce((prev, curr) => prev + curr.compressedSize, 0);

  const license = directory.files.find(file => file.path.endsWith("LICENSE"));
  if (license) await writeFile(license, path.join(destination, "LICENSE"));

  const progress = new ProgressBar(
    `Extracting :bar :extractedBytes / :totalBytes (:etas)`,
    {
      size: 50,
      curr: 0,
      total: totalData,
      extractedBytes: formatBytes(0),
      totalBytes: formatBytes(totalData),
      complete: PROGRESS_COMPLETE,
      incomplete: PROGRESS_INCOMPLETE,
      width: 20,
    },
  );
  progress.tick(0);

  let extractedBytes = 0;
  for (const file of files) {
    const pathSplit = file.path.split(path.sep);
    pathSplit.splice(1, 2);
    const outPath = path.join(destination, pathSplit.join(path.sep));
    if (file.type === "Directory") {
      await fs.mkdir(outPath, { recursive: true });
    } else {
      await writeFile(file, outPath);
      extractedBytes += file.compressedSize;
      progress.tick(file.compressedSize, {
        extractedBytes: formatBytes(extractedBytes),
        totalBytes: formatBytes(totalData),
      });
    }
  }
}
