// src/pages/games/word-squad/render/atlas.js
// Bakes the runtime-drawn art (art.js) into two texture atlases: one canvas,
// one GPU texture each, so hundreds of sprites draw in a few batches. Sizes
// are powers of two so mipmaps work everywhere — far-away bugs stay smooth.
import { CanvasSource, Rectangle, Texture } from 'pixi.js';
import { mainArt, bigArt } from './art.js';

const MAX_W = 2048;

function pack(items, scale, pad) {
  // Shelf packing, tallest first
  const list = Object.entries(items).map(([name, it]) => ({ name, it, pw: Math.ceil(it.w * scale) + pad * 2, ph: Math.ceil(it.h * scale) + pad * 2 }));
  list.sort((a, b) => b.ph - a.ph);
  let x = 0, y = 0, shelf = 0;
  for (const p of list) {
    if (x + p.pw > MAX_W) { x = 0; y += shelf; shelf = 0; }
    p.x = x; p.y = y;
    x += p.pw;
    shelf = Math.max(shelf, p.ph);
  }
  let h = 256;
  while (h < y + shelf) h *= 2;
  return { list, w: MAX_W, h };
}

function bake(items, scale, { mipmaps = true } = {}) {
  const pad = Math.ceil(3 * scale);
  const { list, w, h } = pack(items, scale, pad);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  for (const p of list) {
    ctx.save();
    ctx.translate(p.x + pad, p.y + pad);
    ctx.scale(scale, scale);
    p.it.draw(ctx);
    ctx.restore();
  }
  const source = new CanvasSource({ resource: canvas, autoGenerateMipmaps: mipmaps, scaleMode: 'linear' });
  const out = {};
  for (const p of list) {
    out[p.name] = {
      texture: new Texture({ source, frame: new Rectangle(p.x + pad, p.y + pad, Math.ceil(p.it.w * scale), Math.ceil(p.it.h * scale)) }),
      inv: 1 / scale, // multiply a sprite's scale by this to get logical size
      w: p.it.w,
      h: p.it.h,
    };
  }
  return { textures: out, source, canvas };
}

/**
 * @param quality 'high' | 'low' — low halves the pixel density (phones under load)
 * @returns { get(name) → { texture, inv, w, h }, destroy() }
 */
export function buildAtlases(quality = 'high') {
  const main = bake(mainArt(), quality === 'low' ? 1.25 : 2);
  const big = bake(bigArt(), quality === 'low' ? 0.9 : 1.3);
  const all = { ...main.textures, ...big.textures };
  return {
    get: (name) => {
      const t = all[name];
      if (!t) throw new Error(`Word Squad: no art named "${name}"`);
      return t;
    },
    destroy: () => {
      main.source.destroy();
      big.source.destroy();
    },
  };
}
