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
