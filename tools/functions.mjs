import ffmpeg from "fluent-ffmpeg";
import { createJimp as doCreateJimp } from "@jimp/core";
import { webp } from "./jimp.webp.mjs";
import { defaultPlugins, defaultFormats } from "jimp";
import { promises as fs } from "fs";
import path from "path";

export function formatBytes(bytes) {
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  if (bytes === 0) return `0${sizes[0]}`;

  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${parseFloat((bytes / Math.pow(1024, i)).toFixed(2))} ${sizes[i]}`;
}

export async function fileExists(dir) {
  try {
    await fs.access(dir);
    return true;
  } catch {
    return false;
  }
}

export function randomID(length = 16) {
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  const cutoff = 0x100000000 - (0x100000000 % chars.length);
  const random = new Uint32Array(length);
  do {
    crypto.getRandomValues(random);
  } while (random.some(x => x >= cutoff));
  let id = "";
  for (let i = 0; i < length; i++) id += chars[random[i] % chars.length];
  return id;
}

export function extractFrameCoords(val) {
  const split = val.replaceAll("{", "").replaceAll("}", "").split(",");
  return split.map(item => parseInt(item));
}

export function fitLabel(text, length) {
  if (text.length > length) return text.slice(0, length - 3) + "...";
  else return text.padEnd(length, " ");
}

export async function convertFfmpeg(
  inputPattern,
  outputFile,
  inputOptions,
  outputOptions,
) {
  return new Promise((resolve, reject) => {
    ffmpeg(inputPattern)
      .inputOptions(inputOptions ?? [])
      .outputOptions(outputOptions ?? [])
      .save(outputFile)
      .on("error", reject)
      .on("end", resolve)
      .run();
  });
}

export function createJimp() {
  return doCreateJimp({
    formats: [...defaultFormats, webp],
    plugins: defaultPlugins,
  });
}

export async function writeIndex(config) {
  for (const [key, value] of Object.entries(config)) {
    const outDir = path.join(
      import.meta.dirname,
      "..",
      "src",
      `index.${key}.json`,
    );
    await fs.writeFile(outDir, JSON.stringify(value, null, 2));
  }
}
