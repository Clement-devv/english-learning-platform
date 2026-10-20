// server/utils/videoFile.js
// Sending a recording from local disk (only used without S3): Range requests so a
// <video> can seek, and a read-stream error handler — a file removed mid-request
// (e.g. the 30-day auto-delete) must end that one response, never crash the process.
import fs from "fs";
import logger from "./logger.js";

/**
 * "bytes=start-end" / "bytes=start-" / "bytes=-suffix" → { start, end }.
 * null = no usable range (absent, malformed or multi-range: send the whole file);
 * false = unsatisfiable (answer 416).
 */
export function parseRange(header, size) {
  const m = /^bytes=(\d*)-(\d*)$/.exec(String(header || "").trim());
  if (!m || (!m[1] && !m[2])) return null;
  let start, end;
  if (!m[1]) {
    const suffix = parseInt(m[2], 10);
    if (!suffix) return false;
    start = Math.max(size - suffix, 0);
    end = size - 1;
  } else {
    start = parseInt(m[1], 10);
    end = m[2] ? Math.min(parseInt(m[2], 10), size - 1) : size - 1;
  }
  if (size === 0 || start >= size || start > end) return false;
  return { start, end };
}

function pipeFile(res, filePath, options) {
  fs.createReadStream(filePath, options)
    .on("error", (err) => {
      logger.warn("Video file read failed", { file: filePath, error: err?.message });
      if (!res.headersSent) res.status(404).json({ success: false, message: "File not found" });
      else res.destroy(err);
    })
    .pipe(res);
}

/** Stream a video for playback (honours Range). */
export function sendVideoFile(req, res, filePath, mimeType = "video/webm") {
  let size;
  try { size = fs.statSync(filePath).size; } catch {
    return res.status(404).json({ success: false, message: "File not found" });
  }
  const range = parseRange(req.headers.range, size);
  if (range === false) {
    res.writeHead(416, { "Content-Range": `bytes */${size}` });
    return res.end();
  }
  if (range) {
    res.writeHead(206, {
      "Content-Range": `bytes ${range.start}-${range.end}/${size}`,
      "Accept-Ranges": "bytes",
      "Content-Length": range.end - range.start + 1,
      "Content-Type": mimeType,
    });
    return pipeFile(res, filePath, range);
  }
  res.writeHead(200, { "Content-Length": size, "Content-Type": mimeType, "Accept-Ranges": "bytes" });
  return pipeFile(res, filePath);
}

/** Send a video as a file download. */
export function sendVideoDownload(res, filePath, filename, mimeType = "video/webm") {
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.setHeader("Content-Type", mimeType);
  return pipeFile(res, filePath);
}
