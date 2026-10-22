// server/utils/pwaIcons.js
// The installed app ("Add to Home screen" / Install) uses each center's own icon, not
// the Clemify one. Phones are strict: Android/Chrome wants square PNGs with exact sizes
// (192 and 512, plus a "maskable" one with safe padding); iPhones use a 180px PNG.
//   • Center has a logo (or favicon) → it's fitted, centred, on a white square.
//   • No logo yet → the center's initial on its brand colour.
// Served by GET /pwa-icon/:file (server/index.js) and listed in the per-center
// /manifest.json. Results are cached in memory; ?v= changes when the branding does.
import crypto from "crypto";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import sharp from "sharp";
import Center from "../models/master/Center.js";
import logger from "./logger.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOADS_DIR = path.join(__dirname, "../uploads");

export const ICON_SIZES = [48, 64, 180, 192, 512];
const MAX_SOURCE_BYTES = 5 * 1024 * 1024;

/** The center a request is for: verified custom domain → subdomain → x-center-slug (dev proxy). */
export async function centerFromRequest(req) {
  const host = (req.headers.host || "").split(":")[0].toLowerCase();
  const select = "slug centerName branding.logo branding.favicon branding.primaryColor status";
  let center = host ? await Center.findOne({ customDomain: host, status: "active", domainVerified: true }).select(select).lean() : null;
  if (!center) {
    const parts = host.split(".");
    if (parts.length >= 3 && !/^\d+$/.test(parts[0])) center = await Center.findOne({ slug: parts[0], status: "active" }).select(select).lean();
  }
  const headerSlug = req.headers["x-center-slug"];
  if (!center && typeof headerSlug === "string" && /^[a-z0-9-]{1,63}$/.test(headerSlug)) {
    center = await Center.findOne({ slug: headerSlug, status: "active" }).select(select).lean();
  }
  return center;
}

/** Changes whenever what the icon is made of changes (for ?v= cache busting). */
export const iconVersion = (center) => crypto.createHash("sha1")
  .update([center?.branding?.logo, center?.branding?.favicon, center?.branding?.primaryColor, center?.centerName].join("|"))
  .digest("hex").slice(0, 10);

const HEX = /^#?([0-9a-f]{6}|[0-9a-f]{3})$/i;
const brandColor = (center) => {
  const c = center?.branding?.primaryColor || "";
  return HEX.test(c) ? (c.startsWith("#") ? c : `#${c}`) : "#4F46E5";
};

/** The logo / favicon bytes: an uploaded file (/uploads/branding/…) or an https link (e.g. S3). */
async function loadSource(src) {
  if (!src || typeof src !== "string") return null;
  if (src.startsWith("/uploads/")) {
    const file = path.resolve(UPLOADS_DIR, "." + src.slice("/uploads".length));
    if (!file.startsWith(UPLOADS_DIR + path.sep) || !fs.existsSync(file)) return null;
    return fs.promises.readFile(file);
  }
  if (/^https:\/\//i.test(src)) {
    const res = await fetch(src, { signal: AbortSignal.timeout(6000) });
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    return buf.length <= MAX_SOURCE_BYTES ? buf : null;
  }
  return null;
}

/** Logo fitted (never cropped) and centred on a white square; maskable keeps a wider safe margin. */
async function fromLogo(buf, size, maskable) {
  const inner = Math.round(size * (maskable ? 0.62 : 0.84));
  const logo = await sharp(buf, { density: 300 })
    .resize(inner, inner, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png().toBuffer();
  return sharp({ create: { width: size, height: size, channels: 4, background: "#ffffff" } })
    .composite([{ input: logo, gravity: "center" }])
    .png().toBuffer();
}

/** No logo: the center's initial, white, on its brand colour. */
async function fromInitial(center, size) {
  const letter = (String(center?.centerName || "").trim().match(/[\p{L}\p{N}]/u)?.[0] || "?").toUpperCase();
  const safe = letter.replace(/[&<>"']/g, "");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="${brandColor(center)}"/>
  <text x="256" y="256" dy="0.35em" text-anchor="middle" font-family="DejaVu Sans, Arial, Helvetica, sans-serif"
    font-weight="700" font-size="290" fill="#ffffff">${safe}</text>
</svg>`;
  return sharp(Buffer.from(svg)).resize(size, size).png().toBuffer();
}

const cache = new Map(); // `${slug}:${version}:${size}:${maskable}` → PNG
const CACHE_MAX = 300;

/** PNG icon for a center. Big icons prefer the logo, small ones the favicon. */
export async function pwaIcon(center, size, maskable = false) {
  const key = `${center.slug}:${iconVersion(center)}:${size}:${maskable ? 1 : 0}`;
  if (cache.has(key)) return cache.get(key);
  const b = center.branding || {};
  const sources = size >= 180 ? [b.logo, b.favicon] : [b.favicon, b.logo];
  let png = null;
  for (const src of sources.filter(Boolean)) {
    try {
      const buf = await loadSource(src);
      if (buf) { png = await fromLogo(buf, size, maskable); break; }
    } catch (err) {
      logger.warn("[pwaIcons] could not use branding image", { center: center.slug, error: err?.message });
    }
  }
  if (!png) png = await fromInitial(center, size);
  if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value);
  cache.set(key, png);
  return png;
}

/** Manifest icon list for a center (sizes Chrome requires, versioned URLs). */
export function manifestIcons(center) {
  const v = iconVersion(center);
  return [
    { src: `/pwa-icon/192.png?v=${v}`, sizes: "192x192", type: "image/png", purpose: "any" },
    { src: `/pwa-icon/512.png?v=${v}`, sizes: "512x512", type: "image/png", purpose: "any" },
    { src: `/pwa-icon/512-maskable.png?v=${v}`, sizes: "512x512", type: "image/png", purpose: "maskable" },
  ];
}
