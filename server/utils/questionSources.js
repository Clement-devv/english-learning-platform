// server/utils/questionSources.js
// Where uploaded book pages live: privately in S3 under
// centers/<slug>/question-sources/<id>.<ext> (uploaded straight from the browser
// with a presigned PUT), or — when S3 isn't set up, e.g. local development —
// on this server's disk, like the Teaching Library does.
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { s3Enabled, deleteFromS3, getObjectBuffer } from "./s3.js";
import logger from "./logger.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const LOCAL_DIR = path.join(__dirname, "..", "uploads", "question-sources");

const EXT = { "application/pdf": "pdf", "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

export function sourceKey(slug, id, mime) {
  const file = `${id}.${EXT[mime] || "bin"}`;
  return s3Enabled() ? `centers/${slug}/question-sources/${file}` : `${slug}/${file}`;
}
export const storageKind = () => (s3Enabled() ? "s3" : "local");
const localPath = (key) => {
  const full = path.join(LOCAL_DIR, key);
  if (!full.startsWith(LOCAL_DIR)) throw new Error("Bad key"); // never leave the folder
  return full;
};

export async function saveLocal(key, buffer) {
  const full = localPath(key);
  await fs.promises.mkdir(path.dirname(full), { recursive: true });
  await fs.promises.writeFile(full, buffer);
}

export async function readSource(src) {
  if (src.storage === "s3") return getObjectBuffer(src.key);
  return fs.promises.readFile(localPath(src.key));
}

export async function localExists(key) {
  try { await fs.promises.access(localPath(key)); return true; } catch { return false; }
}

/** Delete the file itself (missing files are fine) */
export async function removeSourceFile(src) {
  try {
    if (src.storage === "s3") await deleteFromS3(src.key);
    else await fs.promises.unlink(localPath(src.key));
  } catch (err) {
    if (err?.code !== "ENOENT") logger.warn("question source delete failed", { key: src.key, error: err?.message });
  }
}
