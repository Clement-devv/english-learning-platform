// server/utils/linkPreview.js
// Rich link previews (WhatsApp, Facebook/Messenger, Zalo, Telegram…) for the
// kids' share links. Those apps' preview bots don't run JavaScript, so the
// Open Graph tags must be in the HTML the server sends — React can't add them.
//
// Deliberately generic: the preview shows the center name and what kind of link
// it is, never the child's name or the homework/quiz details — anyone the message
// is forwarded to sees the preview, and the name check still guards the content.
import fs from "fs/promises";
import path from "path";
import Center from "../models/master/Center.js";
import { cachedQuery } from "./cache.js";

const TENANT_TTL = 60; // same keys + TTL as tenantMiddleware, so they share the cache

// Bump when the preview images change (WhatsApp caches previews per image URL)
const IMAGE_VERSION = 1;

const KINDS = {
  hw: {
    image: "/og/homework.jpg",
    title: (c) => `📚 Homework from ${c}`,
    description: "Your homework mission is ready! Tap to open it — you'll need your name and your teacher's name.",
  },
  q: {
    image: "/og/quiz.jpg",
    title: (c) => `📝 Quiz time — ${c}`,
    description: "A quiz mission is waiting! Tap to start — you'll need your name and your teacher's name.",
  },
  ac: {
    image: "/og/class-check.jpg",
    title: (c) => `✅ Class check from ${c}`,
    description: "Please confirm your child attended their class. It takes about 10 seconds.",
  },
};

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (ch) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));

/** Same resolution order as tenantMiddleware: verified custom domain, then subdomain slug. */
async function centerForHost(host) {
  const byDomain = await cachedQuery(`tenant:domain:${host}`, TENANT_TTL,
    () => Center.findOne({ customDomain: host, status: "active", domainVerified: true }).lean());
  if (byDomain) return byDomain;
  const parts = host.split(".");
  if (parts.length < 3) return null;
  return cachedQuery(`tenant:slug:${parts[0]}`, TENANT_TTL,
    () => Center.findOne({ slug: parts[0], status: "active" }).lean());
}

/**
 * Express handler factory: serves the SPA's index.html with Open Graph tags for
 * /hw/:token, /q/:token and /ac/:token (the kind is the first path segment).
 */
export function linkPreviewHandler(frontendPath) {
  const indexPath = path.join(frontendPath, "index.html");

  return async (req, res, next) => {
    try {
      const kind = KINDS[req.path.split("/")[1]];
      if (!kind) return next();

      const host = (req.headers.host || "").split(":")[0];
      const center = await centerForHost(host).catch(() => null);
      const centerName = center?.centerName || "your school";
      // WhatsApp/Facebook fetch images over HTTPS only — force it for real domains
      // (don't rely on the proxy forwarding the scheme); keep http for localhost testing.
      const isLocal = /^(localhost|127.0.0.1|[::1])$/.test(host);
      const origin = `${isLocal ? req.protocol : "https"}://${req.get("host")}`;

      const title = kind.title(centerName);
      const tags = [
        ["property", "og:type", "website"],
        ["property", "og:site_name", centerName],
        ["property", "og:title", title],
        ["property", "og:description", kind.description],
        ["property", "og:image", `${origin}${kind.image}?v=${IMAGE_VERSION}`],
        ["property", "og:image:type", "image/jpeg"],
        ["property", "og:image:width", "1200"],
        ["property", "og:image:height", "630"],
        ["property", "og:image:alt", title],
        ["name", "twitter:card", "summary_large_image"],
        ["name", "twitter:title", title],
        ["name", "twitter:description", kind.description],
        ["name", "twitter:image", `${origin}${kind.image}?v=${IMAGE_VERSION}`],
        ["name", "robots", "noindex, nofollow"],
      ].map(([attr, key, val]) => `<meta ${attr}="${key}" content="${esc(val)}" />`).join("\n    ");

      let html = await fs.readFile(indexPath, "utf8");
      html = html
        .replace(/<title>[\s\S]*?<\/title>/i, `<title>${esc(title)}</title>`)
        .replace(/<meta\s+name="description"[^>]*>/i, `<meta name="description" content="${esc(kind.description)}" />`)
        .replace(/<\/head>/i, `    ${tags}\n  </head>`);

      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.setHeader("Cache-Control", "public, max-age=300");
      res.setHeader("X-Robots-Tag", "noindex, nofollow");
      res.send(html);
    } catch (err) {
      next(); // fall back to the plain SPA page
    }
  };
}
