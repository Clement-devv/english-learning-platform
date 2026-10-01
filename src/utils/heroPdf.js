// src/utils/heroPdf.js
// Shared "hero mission" PDF report kit (graded homework, quiz results).
// Same world as the kids' link pages (src/components/hero): pale sky page,
// comic ink-outlined cards, star score badge, Mali + Be Vietnam Pro fonts.
import { createElement } from "react";
import api from "../api";
import { getCachedCenter } from "./branding";
import { HERO, HERO_FONTS } from "../components/hero/heroTheme";

export const rgb = (hex) => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
export const fmtDate = (d) => d
  ? new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" })
  : "—";

// Fallback when the theme fonts can't load: built-in fonts are Latin-1 only,
// so strip Vietnamese accents rather than print garbage.
export const latin1 = (s) => String(s ?? "")
  .normalize("NFD").replace(/[̀-ͯ]/g, "")
  .replace(/đ/g, "d").replace(/Đ/g, "D")
  .replace(/[^\x09\x0A\x0D\x20-\x7E\xA0-\xFF]/g, "");

// ── Fonts (fetched once, then cached for the session) ─────────────────────────
let fontCache = null;
async function loadFontData() {
  if (!fontCache) {
    fontCache = (async () => {
      const toBase64 = (buf) => {
        const bytes = new Uint8Array(buf);
        let bin = "";
        for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
        return btoa(bin);
      };
      const get = async (url) => {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`font ${res.status}`);
        return toBase64(await res.arrayBuffer());
      };
      const [heading, body, bodyBold] = await Promise.all([
        get(HERO_FONTS.ttf.headingBold), get(HERO_FONTS.ttf.body), get(HERO_FONTS.ttf.bodyBold),
      ]);
      return { heading, body, bodyBold };
    })().catch((e) => { fontCache = null; throw e; });
  }
  return fontCache;
}

async function registerFonts(doc) {
  try {
    const f = await loadFontData();
    doc.addFileToVFS("Mali-Bold.ttf", f.heading);           doc.addFont("Mali-Bold.ttf", "Mali", "bold");
    doc.addFileToVFS("BeVietnamPro-Regular.ttf", f.body);    doc.addFont("BeVietnamPro-Regular.ttf", "BeVietnam", "normal");
    doc.addFileToVFS("BeVietnamPro-Bold.ttf", f.bodyBold);   doc.addFont("BeVietnamPro-Bold.ttf", "BeVietnam", "bold");
    return { heading: ["Mali", "bold"], body: ["BeVietnam", "normal"], bodyBold: ["BeVietnam", "bold"], clean: (s) => String(s ?? "") };
  } catch (e) {
    console.warn("Hero PDF: theme fonts unavailable, using built-in fonts", e);
    return { heading: ["helvetica", "bold"], body: ["helvetica", "normal"], bodyBold: ["helvetica", "bold"], clean: latin1 };
  }
}

// ── Images ────────────────────────────────────────────────────────────────────
// Render one of the page's SVG characters to a PNG so the PDF shows the same hero.
async function svgComponentToPng(Component, props, widthPx) {
  try {
    const { renderToStaticMarkup } = await import("react-dom/server");
    let svg = renderToStaticMarkup(createElement(Component, props));
    if (!svg.includes("xmlns=")) svg = svg.replace("<svg", '<svg xmlns="http://www.w3.org/2000/svg"');
    const img = await new Promise((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = reject;
      i.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
    });
    const scale = 3;
    const canvas = document.createElement("canvas");
    canvas.width = widthPx * scale;
    canvas.height = Math.round(widthPx * (img.height / img.width)) * scale;
    canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
    return { dataUrl: canvas.toDataURL("image/png"), ratio: canvas.height / canvas.width };
  } catch {
    return null;
  }
}

/** Fetch an authenticated image (e.g. a homework submission photo) as a data URL. */
export async function loadImage(apiPath) {
  try {
    const { data } = await api.get(apiPath, { responseType: "blob" });
    const dataUrl = await new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result);
      r.onerror = reject;
      r.readAsDataURL(data);
    });
    const dims = await new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
      img.onerror = () => resolve(null);
      img.src = dataUrl;
    });
    return dims ? { dataUrl, ...dims } : null;
  } catch {
    return null;
  }
}

// ── Report builder ────────────────────────────────────────────────────────────
/**
 * Creates an A4 report with the first-page sky header drawn.
 *   title      — big header title ("Homework Report")
 *   subtitle   — line under it
 *   stripTitle — text for the slim header on continuation pages
 * Returns helpers to lay out the rest; call `finish()` at the end.
 */
export async function createHeroReport({ title, subtitle, stripTitle }) {
  const { default: jsPDF } = await import("jspdf");
  const { FlyingHero, StarBuddy } = await import("../components/hero/HeroScene");

  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const W = doc.internal.pageSize.getWidth();   // 210
  const H = doc.internal.pageSize.getHeight();  // 297
  const M = 16;                                 // page margin
  const CW = W - M * 2;                         // content width
  const PAD = 7;                                // card padding
  const FOOT = 16;                              // space reserved for the footer
  const SHADOW = 1.6;

  const F = await registerFonts(doc);
  const [hero, buddy] = await Promise.all([
    svgComponentToPng(FlyingHero, { variant: "red", size: 300 }, 300),
    svgComponentToPng(StarBuddy, { size: 120 }, 120),
  ]);
  const centerName = F.clean(getCachedCenter()?.centerName || "");

  const font = ([family, style], size, color = HERO.ink) => {
    doc.setFont(family, style).setFontSize(size).setTextColor(...rgb(color));
  };
  const lineH = (size, lh = 1.6) => size * 0.3528 * lh; // pt → mm

  // ── Page furniture ──
  const paintBackground = () => doc.setFillColor(...rgb(HERO.skyPale)).rect(0, 0, W, H, "F");
  const cloud = (x, y, s) => {
    doc.setFillColor(255, 255, 255);
    doc.circle(x, y, 5 * s, "F"); doc.circle(x + 6 * s, y - 3 * s, 7 * s, "F");
    doc.circle(x + 13 * s, y, 5.5 * s, "F"); doc.roundedRect(x - 2 * s, y - 1 * s, 19 * s, 6 * s, 3 * s, 3 * s, "F");
  };
  const sparkle = (x, y, r, color = "#FFFFFF") => {
    doc.setFillColor(...rgb(color));
    doc.lines([[r * 0.25, r * 0.75], [r * 0.75, r * 0.25], [-r * 0.75, r * 0.25], [-r * 0.25, r * 0.75],
               [-r * 0.25, -r * 0.75], [-r * 0.75, -r * 0.25], [r * 0.75, -r * 0.25]], x, y - r, [1, 1], "F", true);
  };
  const star = (cx, cy, rOuter, rInner, fill, stroke) => {
    const pts = Array.from({ length: 10 }).map((_, i) => {
      const r = i % 2 ? rInner : rOuter, a = -Math.PI / 2 + (Math.PI * i) / 5;
      return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
    });
    const segs = pts.slice(1).map((p, i) => [p[0] - pts[i][0], p[1] - pts[i][1]]);
    doc.setFillColor(...rgb(fill)).setDrawColor(...rgb(stroke)).setLineWidth(0.9).setLineJoin("round");
    doc.lines(segs, pts[0][0], pts[0][1], [1, 1], "FD", true);
  };
  const comicBox = (x, y, w, h, fill = HERO.paper, r = 4) => {
    doc.setFillColor(...rgb(HERO.ink)).roundedRect(x + SHADOW, y + SHADOW, w, h, r, r, "F");
    doc.setFillColor(...rgb(fill)).setDrawColor(...rgb(HERO.ink)).setLineWidth(0.7).roundedRect(x, y, w, h, r, r, "FD");
  };
  // Right/wrong badge drawn as vectors (fonts may lack ✓ ✗ glyphs)
  const marker = (cx, cy, right) => {
    doc.setFillColor(...rgb(right ? HERO.green : HERO.red)).setDrawColor(...rgb(HERO.ink)).setLineWidth(0.45).circle(cx, cy, 2.7, "FD");
    doc.setDrawColor(255, 255, 255).setLineWidth(0.75).setLineCap("round").setLineJoin("round");
    if (right) doc.lines([[0.9, 0.9], [1.8, -2]], cx - 1.35, cy + 0.1, [1, 1], "S", false);
    else { doc.line(cx - 1.1, cy - 1.1, cx + 1.1, cy + 1.1); doc.line(cx + 1.1, cy - 1.1, cx - 1.1, cy + 1.1); }
  };

  // ── Pages ──
  let y = 0;
  const newPage = () => {
    doc.addPage();
    paintBackground();
    doc.setFillColor(...rgb(HERO.skyTop)).rect(0, 0, W, 14, "F");
    cloud(W - 48, 8, 0.45); cloud(W - 26, 6, 0.35);
    font(F.heading, 11, HERO.ink);
    doc.text(F.clean(stripTitle).slice(0, 80), M, 9);
    y = 24;
  };
  const ensure = (needed) => { if (y + needed > H - FOOT) newPage(); };

  // First page header: sky, sun, clouds, sparkles, flying hero
  paintBackground();
  const HEAD = 64;
  doc.setFillColor(...rgb(HERO.skyTop)).rect(0, 0, W, HEAD, "F");
  doc.setDrawColor(...rgb(HERO.sun)).setLineWidth(2.2).setLineCap("round");
  for (let i = 0; i < 12; i++) {
    const a = (Math.PI * 2 * i) / 12;
    doc.line(W - 14 + Math.cos(a) * 17, 10 + Math.sin(a) * 17, W - 14 + Math.cos(a) * 23, 10 + Math.sin(a) * 23);
  }
  doc.setFillColor(...rgb(HERO.sun)).setDrawColor(...rgb(HERO.sunDeep)).setLineWidth(1).circle(W - 14, 10, 13, "FD");
  cloud(12, 50, 0.9); cloud(W - 70, 22, 0.7); cloud(W - 40, 52, 0.6);
  sparkle(96, 12, 2.6); sparkle(150, 40, 2); sparkle(30, 30, 1.8);
  if (hero) doc.addImage(hero.dataUrl, "PNG", W - 92, 14, 62, 62 * hero.ratio);
  if (centerName) {
    font(F.bodyBold, 9, HERO.ink);
    doc.text(centerName.toUpperCase(), M, 20, { charSpace: 0.6 });
  }
  font(F.heading, 28, HERO.ink);
  doc.text(F.clean(title), M, 34);
  font(F.body, 11, HERO.ink);
  doc.text(F.clean(subtitle), M, 43);
  doc.setFillColor(...rgb(HERO.ink)).rect(0, HEAD, W, 1.2, "F");
  y = HEAD + 12;

  const api_ = {
    doc, F, font, W, H, M, CW, PAD,
    clean: F.clean,

    /**
     * Student card + star badge.
     *   name, heading (red line), cols: [[LABEL, value] ×3],
     *   badge: { big: "92", small: "OUT OF 100", stamp: "Super Hero!" }
     */
    summary({ name, heading, cols, badge }) {
      const infoW = CW - 58, infoH = 50;
      comicBox(M, y, infoW, infoH);
      font(F.bodyBold, 8, HERO.inkSoft);
      doc.text("STUDENT", M + PAD, y + 10, { charSpace: 0.5 });
      font(F.heading, 18, HERO.ink);
      doc.text(doc.splitTextToSize(F.clean(name), infoW - PAD * 2)[0], M + PAD, y + 19);
      font(F.heading, 13, HERO.redDeep);
      doc.text(doc.splitTextToSize(F.clean(heading), infoW - PAD * 2)[0], M + PAD, y + 27);

      const colW = (infoW - PAD * 2) / cols.length;
      doc.setDrawColor(...rgb("#D5DBEF")).setLineWidth(0.3).line(M + PAD, y + 32, M + infoW - PAD, y + 32);
      cols.forEach(([label, value], i) => {
        const x = M + PAD + i * colW;
        font(F.bodyBold, 7.5, HERO.inkSoft); doc.text(label, x, y + 38.5, { charSpace: 0.4 });
        font(F.bodyBold, 10, HERO.ink);      doc.text(doc.splitTextToSize(F.clean(value), colW - 3)[0], x, y + 44.5);
      });

      const bx = M + infoW + 8, bw = CW - infoW - 8;
      comicBox(bx, y, bw, infoH, "#FFF7D6");
      star(bx + bw / 2, y + 20, 17, 8.5, HERO.sun, HERO.ink);
      font(F.heading, badge.big.length > 3 ? 13 : badge.big.length > 2 ? 15 : 18, HERO.ink);
      doc.text(badge.big, bx + bw / 2, y + 23.5, { align: "center" });
      font(F.bodyBold, 7.5, HERO.inkSoft);
      doc.text(badge.small, bx + bw / 2, y + 41, { align: "center", charSpace: 0.4 });
      font(F.heading, 11, HERO.redDeep);
      doc.text(badge.stamp || "", bx + bw / 2, y + 47, { align: "center" });
      y += infoH + 12;
    },

    /**
     * Comic card with a title and wrapped paragraphs; splits across pages and
     * never strands 1–3 lines. Paragraph: { text, style, size, color, gap, indent, marker: true|false, group }
     * Paragraphs sharing a `group` are kept on the same page when possible (e.g. one quiz question).
     * (`marker` draws a ✓/✗ badge at the paragraph's first line; use with `indent`).
     */
    textCard(title, accent, paragraphs, fill = HERO.paper) {
      const rows = [];
      for (const p of paragraphs) {
        const size = p.size || 11, indent = p.indent || 0;
        font(p.style || F.body, size, p.color);
        doc.splitTextToSize(F.clean(p.text), CW - PAD * 2 - indent)
          .forEach((str, i) => rows.push({ ...p, size, indent, str, h: lineH(size), first: i === 0 }));
        if (rows.length) rows[rows.length - 1].h += p.gap ?? 3;
      }
      const TITLE_H = 13, FIRST_BL = TITLE_H + 5, MIN_LINES = 4;
      const descent = (r) => r.size * 0.3528 * 0.3;
      const boxH = (chunk) => FIRST_BL + chunk.slice(0, -1).reduce((s, r) => s + r.h, 0) + descent(chunk[chunk.length - 1]) + PAD;

      let first = true;
      while (rows.length) {
        const fits = (n) => boxH(rows.slice(0, n)) <= H - FOOT - y - SHADOW;
        if (!fits(Math.min(MIN_LINES, rows.length))) newPage();
        let take = 1;
        while (take < rows.length && fits(take + 1)) take++;
        if (take < rows.length && rows.length - take < MIN_LINES && take > MIN_LINES) take = Math.max(MIN_LINES, rows.length - MIN_LINES);
        // Don't split a group (e.g. one quiz question) — break before it instead
        if (take < rows.length && rows[take].group != null && rows[take].group === rows[take - 1].group) {
          let start = take - 1;
          while (start > 0 && rows[start - 1].group === rows[take].group) start--;
          if (start > 0) take = start;
        }
        const chunk = rows.splice(0, take);
        const hBox = boxH(chunk);

        comicBox(M, y, CW, hBox, fill);
        doc.setFillColor(...rgb(accent)).setDrawColor(...rgb(HERO.ink)).setLineWidth(0.6).circle(M + PAD + 2.6, y + 8.4, 2.6, "FD");
        font(F.heading, 13, HERO.ink);
        doc.text(first ? F.clean(title) : `${F.clean(title)} (continued)`, M + PAD + 8, y + 10);
        let ty = y + FIRST_BL;
        for (const r of chunk) {
          if (r.first && typeof r.marker === "boolean") marker(M + PAD + 2.7, ty - r.size * 0.3528 * 0.33, r.marker);
          font(r.style || F.body, r.size, r.color || HERO.ink);
          doc.text(r.str, M + PAD + r.indent, ty);
          ty += r.h;
        }
        y += hBox + 9;
        first = false;
      }
    },

    /** A photo in a comic frame (scaled to fit the page). */
    photo(img, mimeType) {
      const maxW = CW - PAD * 2, maxH = H - FOOT - 24 - PAD * 2 - 14;
      const s = Math.min(maxW / img.w, maxH / img.h);
      const w = img.w * s, h = img.h * s;
      ensure(h + PAD * 2 + 4);
      comicBox(M, y, CW, h + PAD * 2);
      doc.addImage(img.dataUrl, mimeType === "image/png" ? "PNG" : "JPEG", M + (CW - w) / 2, y + PAD, w, h);
      y += h + PAD * 2 + 10;
    },

    /** Star buddy sign-off at the end of the report. */
    signOff(line, subline) {
      ensure(26);
      const x = M + (buddy ? 22 : 0);
      if (buddy) doc.addImage(buddy.dataUrl, "PNG", M, y, 18, 18);
      font(F.heading, 13, HERO.ink);
      doc.text(F.clean(line), x, y + 8);
      font(F.body, 9.5, HERO.inkSoft);
      doc.text(F.clean(subline), x, y + 14);
      y += 26;
    },

    /** Footer on every page, then save — or return a blob URL with { output: "bloburl" }. */
    finish(fileBase, options = {}) {
      const pages = doc.getNumberOfPages();
      for (let i = 1; i <= pages; i++) {
        doc.setPage(i);
        doc.setDrawColor(...rgb("#C9D6EE")).setLineWidth(0.3).line(M, H - 11, W - M, H - 11);
        font(F.body, 8, HERO.inkSoft);
        if (centerName) doc.text(centerName, M, H - 6.5);
        doc.text(`Page ${i} of ${pages}`, W - M, H - 6.5, { align: "right" });
      }
      if (options.output === "bloburl") return doc.output("bloburl");
      doc.save(`${fileBase}.pdf`);
      return null;
    },
  };
  return api_;
}

/** Safe file-name piece: "Nguyễn Thị Linh" → "Nguyen-Thi-Linh". */
export const fileSafe = (s) => latin1(s).replace(/[^\w\s-]/g, "").trim().replace(/\s+/g, "-").slice(0, 40) || "report";
