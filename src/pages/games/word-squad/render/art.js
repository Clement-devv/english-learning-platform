// src/pages/games/word-squad/render/art.js
// Every character, bug, boss, prop and particle is vector art drawn here at
// runtime with the Canvas 2D API (real gradients, outlines, rim light), then
// baked once into texture atlases by atlas.js — nothing is downloaded.
//
// Each entry: name → { w, h, draw(ctx) } in logical pixels (size on screen
// when the thing stands right at the squad). All designs are original.

const INK = '#2a1f45';          // cartoon outline
const OUT = 3;

// ── Helpers ──────────────────────────────────────────────────────────────────
function rr(ctx, x, y, w, h, r) {
  const k = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + k, y);
  ctx.arcTo(x + w, y, x + w, y + h, k);
  ctx.arcTo(x + w, y + h, x, y + h, k);
  ctx.arcTo(x, y + h, x, y, k);
  ctx.arcTo(x, y, x + w, y, k);
  ctx.closePath();
}
function ell(ctx, cx, cy, rx, ry, rot = 0) {
  ctx.beginPath();
  ctx.ellipse(cx, cy, Math.max(0.1, rx), Math.max(0.1, ry), rot, 0, Math.PI * 2);
}
function lin(ctx, x0, y0, x1, y1, stops) {
  const g = ctx.createLinearGradient(x0, y0, x1, y1);
  stops.forEach(([o, c]) => g.addColorStop(o, c));
  return g;
}
function rad(ctx, cx, cy, r0, r1, stops, ox = 0, oy = 0) {
  const g = ctx.createRadialGradient(cx + ox, cy + oy, r0, cx, cy, r1);
  stops.forEach(([o, c]) => g.addColorStop(o, c));
  return g;
}
function fillStroke(ctx, fill, width = OUT, stroke = INK) {
  ctx.fillStyle = fill;
  ctx.fill();
  if (width) { ctx.lineWidth = width; ctx.strokeStyle = stroke; ctx.stroke(); }
}
/** A soft white highlight streak — the "rim light" on rounded shapes */
function rim(ctx, cx, cy, rx, ry, from = -2.4, to = -1.2, width = 3, alpha = 0.75) {
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, 0, from, to);
  ctx.lineCap = 'round';
  ctx.lineWidth = width;
  ctx.strokeStyle = `rgba(255,255,255,${alpha})`;
  ctx.stroke();
  ctx.restore();
}
function shine(ctx, cx, cy, rx, ry, alpha = 0.55) {
  ell(ctx, cx, cy, rx, ry, -0.5);
  ctx.fillStyle = `rgba(255,255,255,${alpha})`;
  ctx.fill();
}
function shade(hex, f) { // f > 0 lighter, < 0 darker
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  const t = f < 0 ? 0 : 255, p = Math.abs(f);
  r = Math.round((t - r) * p + r); g = Math.round((t - g) * p + g); b = Math.round((t - b) * p + b);
  return `rgb(${r},${g},${b})`;
}
function star(ctx, cx, cy, r1, r2, points = 5, rot = -Math.PI / 2) {
  ctx.beginPath();
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 ? r2 : r1;
    const a = rot + (i * Math.PI) / points;
    ctx.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
  }
  ctx.closePath();
}

// ── Squad soldiers (back view) ───────────────────────────────────────────────
export const SUITS = {
  blaster: { suit: '#3d8bff', trim: '#bfe0ff', gun: '#5a6378' },
  double:  { suit: '#19b5a5', trim: '#b8fff2', gun: '#4d5a6e' },
  minigun: { suit: '#ff8a1f', trim: '#ffe0b3', gun: '#3f4656' },
  laser:   { suit: '#ff4fa3', trim: '#ffd1ea', gun: '#7b2cbf' },
  rockets: { suit: '#8b5cf6', trim: '#e2d6ff', gun: '#4b5563' },
};

function drawGun(ctx, weapon, c) {
  ctx.save();
  ctx.translate(34, 20);
  if (weapon === 'blaster') {
    rr(ctx, -4, -16, 8, 24, 3); fillStroke(ctx, c.gun, 2.5);
    rr(ctx, -2, -20, 4, 6, 2); fillStroke(ctx, '#9be7ff', 2);
  } else if (weapon === 'double') {
    rr(ctx, -7, -18, 6, 26, 3); fillStroke(ctx, c.gun, 2.5);
    rr(ctx, 1, -18, 6, 26, 3); fillStroke(ctx, c.gun, 2.5);
    rr(ctx, -6, -22, 12, 5, 2); fillStroke(ctx, '#7dfcf0', 2);
  } else if (weapon === 'minigun') {
    rr(ctx, -7, -6, 14, 16, 4); fillStroke(ctx, c.gun, 2.5);
    for (let i = -1; i <= 1; i++) { rr(ctx, i * 4 - 1.5, -24, 3, 20, 1.5); fillStroke(ctx, '#8a93a6', 1.5); }
    ell(ctx, 0, -6, 7, 3); fillStroke(ctx, '#ffd166', 2);
  } else if (weapon === 'laser') {
    rr(ctx, -5, -22, 10, 32, 5); fillStroke(ctx, c.gun, 2.5);
    rr(ctx, -2.5, -28, 5, 10, 2.5); fillStroke(ctx, '#ff9bd2', 2);
    ell(ctx, 0, -28, 4, 4); ctx.fillStyle = 'rgba(255,200,240,0.9)'; ctx.fill();
  } else if (weapon === 'rockets') {
    ctx.translate(-6, -4);
    rr(ctx, -6, -22, 13, 30, 6); fillStroke(ctx, c.gun, 2.5);
    ell(ctx, 0.5, -22, 5, 4); fillStroke(ctx, '#ff6b6b', 2);
    rr(ctx, -7, -6, 15, 4, 2); fillStroke(ctx, '#ffd166', 1.5);
  }
  ctx.restore();
}

function soldier(weapon, frame) {
  const c = SUITS[weapon];
  return {
    w: 48, h: 64,
    draw(ctx) {
      const swing = [0, 1, 0, -1][frame];
      const bob = frame % 2 ? -1.2 : 0;
      // legs (walking)
      for (const side of [-1, 1]) {
        const lift = side * swing;
        rr(ctx, 24 + side * 6 - 4, 44 - Math.max(0, lift) * 4 + bob, 8, 16 + Math.min(0, lift) * 2, 4);
        fillStroke(ctx, shade(c.suit, -0.35), 2.5);
        rr(ctx, 24 + side * 6 - 5, 56 - Math.max(0, lift) * 4 + bob + Math.min(0, lift) * 2, 10, 6, 3);
        fillStroke(ctx, '#2f2a3d', 2);
      }
      ctx.translate(0, bob);
      // body
      rr(ctx, 11, 22, 26, 26, 10);
      fillStroke(ctx, lin(ctx, 11, 22, 37, 48, [[0, shade(c.suit, 0.2)], [1, shade(c.suit, -0.25)]]));
      // arms
      for (const side of [-1, 1]) {
        ell(ctx, 24 + side * 14, 33 + side * swing * 1.5, 5, 8, side * 0.3);
        fillStroke(ctx, shade(c.suit, -0.1), 2.5);
      }
      // backpack
      rr(ctx, 15, 25, 18, 18, 6);
      fillStroke(ctx, lin(ctx, 15, 25, 33, 43, [[0, '#ffe08a'], [1, '#e09f2b']]), 2.5);
      rr(ctx, 18, 29, 12, 5, 2.5); fillStroke(ctx, '#fff3c4', 1.5);
      // head (helmet, from behind)
      ell(ctx, 24, 15, 11, 11);
      fillStroke(ctx, rad(ctx, 24, 15, 2, 12, [[0, shade(c.suit, 0.45)], [1, shade(c.suit, -0.15)]], -3, -4));
      rr(ctx, 13, 16, 22, 4, 2); fillStroke(ctx, c.trim, 2);
      rim(ctx, 24, 15, 9, 9, -2.6, -1.4, 2.5, 0.8);
      rim(ctx, 24, 35, 11, 11, -2.9, -2.1, 2.5, 0.5);
      drawGun(ctx, weapon, c);
    },
  };
}

// ── Bugs (front view, walking toward the squad) ──────────────────────────────
// eyes: centres of the two eyeballs, so pupils can be drawn on a separate layer
export const BUG_EYES = {
  beetle:    { y: 25, dx: 8, r: 6.5 },
  bee:       { y: 22, dx: 7.5, r: 6 },
  snail:     { y: 10, dx: 8, r: 6 },
  spiderbot: { y: 26, dx: 8, r: 6.5 },
};
const BUG_SIZE = { w: 64, h: 64 };

function eyesWhite(ctx, species) {
  const e = BUG_EYES[species];
  for (const s of [-1, 1]) { ell(ctx, 32 + s * e.dx, e.y, e.r, e.r * 1.1); fillStroke(ctx, '#ffffff', 2.2); }
}
function brows(ctx, species, angry) {
  if (!angry) return;
  const e = BUG_EYES[species];
  ctx.lineWidth = 3; ctx.strokeStyle = INK; ctx.lineCap = 'round';
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(32 + s * (e.dx + e.r), e.y - e.r - 3);
    ctx.lineTo(32 + s * 2, e.y - e.r + 1);
    ctx.stroke();
  }
}
function angryGlow(ctx, cx, cy, r) {
  ell(ctx, cx, cy, r, r * 0.9);
  ctx.fillStyle = rad(ctx, cx, cy, r * 0.3, r, [[0, 'rgba(255,60,60,0.55)'], [1, 'rgba(255,60,60,0)']]);
  ctx.fill();
}

function bug(species, frame, angry) {
  return {
    ...BUG_SIZE,
    draw(ctx) {
      const step = frame ? 1 : -1;
      if (angry) angryGlow(ctx, 32, 34, 32);
      if (species === 'beetle') {
        const shell = angry ? '#e63946' : '#2ec27e';
        for (const s of [-1, 1]) for (let i = 0; i < 3; i++) {
          ctx.beginPath(); ctx.lineWidth = 3; ctx.strokeStyle = INK; ctx.lineCap = 'round';
          const y = 38 + i * 7, lift = (i % 2 ? step : -step) * 2.5;
          ctx.moveTo(32 + s * 12, y); ctx.lineTo(32 + s * 24, y + 5 + lift); ctx.stroke();
        }
        ell(ctx, 32, 40, 19, 17); fillStroke(ctx, rad(ctx, 32, 40, 3, 21, [[0, shade(shell, 0.35)], [1, shade(shell, -0.3)]], -6, -6));
        ctx.beginPath(); ctx.moveTo(32, 24); ctx.lineTo(32, 57); ctx.lineWidth = 2.5; ctx.strokeStyle = INK; ctx.stroke();
        for (const [x, y] of [[24, 42], [40, 42], [27, 51], [37, 51]]) { ell(ctx, x, y, 3, 3); ctx.fillStyle = shade(shell, -0.45); ctx.fill(); }
        ell(ctx, 32, 24, 13, 10); fillStroke(ctx, '#3b3157');
        shine(ctx, 25, 33, 6, 3.5);
        eyesWhite(ctx, species);
        ctx.beginPath(); ctx.lineWidth = 2.5; ctx.strokeStyle = INK;
        for (const s of [-1, 1]) { ctx.moveTo(32 + s * 5, 15); ctx.quadraticCurveTo(32 + s * 9, 6, 32 + s * 13, 6 + step); }
        ctx.stroke();
        for (const s of [-1, 1]) { ell(ctx, 32 + s * 13, 6 + step, 2.5, 2.5); fillStroke(ctx, '#ffd166', 1.5); }
      } else if (species === 'bee') {
        const wingUp = frame ? -4 : 3;
        for (const s of [-1, 1]) {
          ell(ctx, 32 + s * 17, 24 + wingUp, 12, 8, s * (0.5 + wingUp * 0.05));
          fillStroke(ctx, 'rgba(220,240,255,0.8)', 2);
        }
        ell(ctx, 32, 40, 15, 16);
        ctx.save(); ctx.clip();
        ctx.fillStyle = rad(ctx, 32, 40, 2, 18, [[0, '#ffe680'], [1, angry ? '#ff9f1c' : '#f7b801']], -5, -5); ctx.fillRect(10, 20, 44, 40);
        ctx.fillStyle = '#3b3157'; ctx.fillRect(10, 40, 44, 5); ctx.fillRect(10, 50, 44, 5);
        ctx.restore();
        ell(ctx, 32, 40, 15, 16); ctx.lineWidth = OUT; ctx.strokeStyle = INK; ctx.stroke();
        ctx.beginPath(); ctx.moveTo(29, 56); ctx.lineTo(32, 63); ctx.lineTo(35, 56); fillStroke(ctx, '#3b3157', 2);
        ell(ctx, 32, 22, 12, 11); fillStroke(ctx, rad(ctx, 32, 22, 2, 12, [[0, '#ffe680'], [1, '#f2a900']], -3, -3));
        shine(ctx, 25, 34, 5, 3);
        eyesWhite(ctx, species);
      } else if (species === 'snail') {
        const stretch = frame ? 2 : 0;
        rr(ctx, 12 - stretch, 46, 40 + stretch * 2, 14, 7); fillStroke(ctx, angry ? '#ff8fab' : '#b8f2a1');
        ell(ctx, 32, 38, 18, 17);
        fillStroke(ctx, rad(ctx, 32, 38, 2, 20, [[0, '#ffd6a5'], [1, angry ? '#e85d75' : '#e07a5f']], -5, -6));
        ctx.beginPath(); ctx.lineWidth = 3; ctx.strokeStyle = shade('#e07a5f', -0.4);
        for (let a = 0; a < 11; a += 0.2) { const r = 1 + a * 1.4; ctx.lineTo(32 + Math.cos(a) * r, 38 + Math.sin(a) * r); }
        ctx.stroke();
        shine(ctx, 25, 31, 5, 3);
        for (const s of [-1, 1]) {
          ctx.beginPath(); ctx.lineWidth = 3.5; ctx.strokeStyle = INK; ctx.moveTo(32 + s * 4, 26); ctx.lineTo(32 + s * 8, 14); ctx.stroke();
          ctx.beginPath(); ctx.lineWidth = 2.5; ctx.strokeStyle = angry ? '#ff8fab' : '#b8f2a1'; ctx.moveTo(32 + s * 4, 26); ctx.lineTo(32 + s * 8, 14); ctx.stroke();
        }
        eyesWhite(ctx, species);
      } else if (species === 'spiderbot') {
        for (const s of [-1, 1]) for (let i = 0; i < 3; i++) {
          const lift = (i % 2 ? step : -step) * 3;
          ctx.beginPath(); ctx.lineWidth = 4; ctx.strokeStyle = INK; ctx.lineCap = 'round';
          ctx.moveTo(32 + s * 10, 40 + i * 4); ctx.lineTo(32 + s * (22 + i * 2), 34 + i * 4 + lift); ctx.lineTo(32 + s * (26 + i), 58 + lift); ctx.stroke();
          ctx.beginPath(); ctx.lineWidth = 2; ctx.strokeStyle = '#a5b4cb';
          ctx.moveTo(32 + s * 10, 40 + i * 4); ctx.lineTo(32 + s * (22 + i * 2), 34 + i * 4 + lift); ctx.lineTo(32 + s * (26 + i), 58 + lift); ctx.stroke();
        }
        ell(ctx, 32, 38, 17, 15);
        fillStroke(ctx, rad(ctx, 32, 38, 2, 18, [[0, '#e9eef6'], [1, angry ? '#c0392b' : '#7d8ba3']], -5, -6));
        rr(ctx, 18, 42, 28, 6, 3); fillStroke(ctx, angry ? '#ff6b6b' : '#5ce1e6', 2);
        shine(ctx, 25, 31, 6, 3.5);
        ctx.beginPath(); ctx.lineWidth = 2.5; ctx.strokeStyle = INK; ctx.moveTo(32, 23); ctx.lineTo(32, 14); ctx.stroke();
        ell(ctx, 32, 13, 3.5, 3.5); fillStroke(ctx, frame ? '#ff6b6b' : '#ffd166', 2);
        eyesWhite(ctx, species);
      }
      brows(ctx, species, angry);
    },
  };
}
function pupils(species) {
  return {
    ...BUG_SIZE,
    draw(ctx) {
      const e = BUG_EYES[species];
      for (const s of [-1, 1]) {
        ell(ctx, 32 + s * e.dx, e.y + 1.5, e.r * 0.48, e.r * 0.55); ctx.fillStyle = INK; ctx.fill();
        ell(ctx, 32 + s * e.dx - 1.2, e.y, 1.2, 1.2); ctx.fillStyle = '#fff'; ctx.fill();
      }
    },
  };
}

// ── Props, crates, effects ───────────────────────────────────────────────────
const CANDY = ['#ff5d8f', '#ffd166', '#06d6a0', '#4cc9f0', '#b388ff', '#ff9f1c'];
export const CANDY_COLORS = CANDY.map((c) => parseInt(c.slice(1), 16));

const ITEMS = {
  shadow: { w: 64, h: 22, draw(ctx) { ell(ctx, 32, 11, 30, 9); ctx.fillStyle = rad(ctx, 32, 11, 4, 30, [[0, 'rgba(40,20,70,0.45)'], [1, 'rgba(40,20,70,0)']]); ctx.fill(); } },
  crate: {
    w: 66, h: 66,
    draw(ctx) {
      rr(ctx, 5, 9, 56, 54, 9); fillStroke(ctx, lin(ctx, 5, 9, 61, 63, [[0, '#ff6b6b'], [1, '#c81d4a']]), 3.5);
      ctx.lineWidth = 4; ctx.strokeStyle = '#8f1239';
      ctx.beginPath(); ctx.moveTo(12, 16); ctx.lineTo(54, 56); ctx.moveTo(54, 16); ctx.lineTo(12, 56); ctx.stroke();
      rr(ctx, 5, 9, 56, 54, 9); ctx.lineWidth = 3.5; ctx.strokeStyle = INK; ctx.stroke();
      rr(ctx, 21, 25, 24, 22, 7); fillStroke(ctx, '#fff3c4', 3);
      ctx.fillStyle = '#c81d4a'; ctx.font = '900 20px Nunito, Arial, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('?', 33, 37);
      rim(ctx, 33, 36, 26, 25, -2.7, -1.9, 3, 0.6);
    },
  },
  gumdrop: { w: 20, h: 20, draw(ctx) { ctx.beginPath(); ctx.moveTo(2, 17); ctx.quadraticCurveTo(2, 2, 10, 2); ctx.quadraticCurveTo(18, 2, 18, 17); ctx.closePath(); fillStroke(ctx, '#ffffff', 1.5, 'rgba(42,31,69,0.5)'); shine(ctx, 7, 7, 2.5, 1.5, 0.9); } },
  sprinkle: { w: 16, h: 7, draw(ctx) { rr(ctx, 1, 1, 14, 5, 2.5); ctx.fillStyle = '#ffffff'; ctx.fill(); } },
  starSmall: { w: 22, h: 22, draw(ctx) { star(ctx, 11, 11, 10, 4.5); fillStroke(ctx, '#ffffff', 1.5, 'rgba(42,31,69,0.4)'); } },
  starGold: {
    w: 34, h: 34,
    draw(ctx) {
      star(ctx, 17, 17, 15, 7); fillStroke(ctx, lin(ctx, 4, 4, 30, 30, [[0, '#fff3b0'], [0.5, '#ffd166'], [1, '#f4a100']]), 2.5, '#9a5b00');
      shine(ctx, 13, 12, 3, 2, 0.9);
    },
  },
  glow: { w: 64, h: 64, draw(ctx) { ell(ctx, 32, 32, 31, 31); ctx.fillStyle = rad(ctx, 32, 32, 0, 31, [[0, 'rgba(255,255,255,1)'], [0.35, 'rgba(255,255,255,0.45)'], [1, 'rgba(255,255,255,0)']]); ctx.fill(); } },
  ring: { w: 96, h: 96, draw(ctx) { ell(ctx, 48, 48, 42, 42); ctx.lineWidth = 7; ctx.strokeStyle = 'rgba(255,255,255,0.95)'; ctx.stroke(); ell(ctx, 48, 48, 42, 42); ctx.lineWidth = 14; ctx.strokeStyle = 'rgba(255,255,255,0.25)'; ctx.stroke(); } },
  smoke: { w: 48, h: 48, draw(ctx) { for (const [x, y, r] of [[24, 26, 15], [15, 22, 10], [33, 20, 11], [24, 15, 10]]) { ell(ctx, x, y, r, r); ctx.fillStyle = 'rgba(255,255,255,0.55)'; ctx.fill(); } } },
  spark: {
    w: 40, h: 40,
    draw(ctx) {
      star(ctx, 20, 20, 19, 4, 4, 0); ctx.fillStyle = '#ffffff'; ctx.fill();
      ell(ctx, 20, 20, 7, 7); ctx.fillStyle = '#ffffff'; ctx.fill();
    },
  },
  confetti: { w: 10, h: 6, draw(ctx) { ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, 10, 6); } },
  tracer: { w: 12, h: 36, draw(ctx) { rr(ctx, 2, 2, 8, 32, 4); ctx.fillStyle = lin(ctx, 0, 2, 0, 34, [[0, 'rgba(255,255,255,1)'], [1, 'rgba(255,255,255,0)']]); ctx.fill(); rr(ctx, 4, 2, 4, 14, 2); ctx.fillStyle = '#ffffff'; ctx.fill(); } },
  rocket: {
    w: 16, h: 34,
    draw(ctx) {
      rr(ctx, 4, 4, 8, 22, 4); fillStroke(ctx, '#f1f5f9', 2);
      ctx.beginPath(); ctx.moveTo(4, 8); ctx.quadraticCurveTo(8, -2, 12, 8); fillStroke(ctx, '#ff4d6d', 2);
      ctx.beginPath(); ctx.moveTo(4, 22); ctx.lineTo(1, 30); ctx.lineTo(6, 26); fillStroke(ctx, '#ff4d6d', 1.5);
      ctx.beginPath(); ctx.moveTo(12, 22); ctx.lineTo(15, 30); ctx.lineTo(10, 26); fillStroke(ctx, '#ff4d6d', 1.5);
      ell(ctx, 8, 30, 3, 4); ctx.fillStyle = '#ffd166'; ctx.fill();
    },
  },
  lollipopTree: {
    w: 76, h: 150,
    draw(ctx) {
      rr(ctx, 34, 60, 8, 86, 4); fillStroke(ctx, '#fff7ed', 2.5);
      ell(ctx, 38, 40, 32, 32); fillStroke(ctx, rad(ctx, 38, 40, 4, 34, [[0, '#ffc2e2'], [1, '#ff5d8f']], -8, -8));
      ctx.save(); ell(ctx, 38, 40, 31, 31); ctx.clip();
      ctx.lineWidth = 6; ctx.strokeStyle = 'rgba(255,255,255,0.75)'; ctx.beginPath();
      for (let a = 0; a < 16; a += 0.15) { const r = a * 2.1; ctx.lineTo(38 + Math.cos(a) * r, 40 + Math.sin(a) * r); }
      ctx.stroke(); ctx.restore();
      shine(ctx, 26, 28, 7, 4, 0.6);
    },
  },
  gumTree: {
    w: 84, h: 130,
    draw(ctx) {
      rr(ctx, 37, 70, 10, 56, 4); fillStroke(ctx, '#a0663a', 2.5);
      for (const [x, y, r, c] of [[26, 58, 20, '#7bd389'], [58, 56, 20, '#5cc979'], [42, 36, 26, '#8fe39b'], [42, 62, 18, '#6bcb77']]) {
        ell(ctx, x, y, r, r); fillStroke(ctx, rad(ctx, x, y, 2, r, [[0, shade(c, 0.3)], [1, c]], -r / 3, -r / 3), 2.5);
      }
      for (const [x, y, c] of [[30, 40, '#ff5d8f'], [52, 32, '#ffd166'], [56, 60, '#4cc9f0'], [32, 66, '#b388ff']]) { ell(ctx, x, y, 5, 5); fillStroke(ctx, c, 2); }
    },
  },
  bush: {
    w: 96, h: 58,
    draw(ctx) {
      for (const [x, y, r] of [[24, 38, 18], [48, 30, 24], [72, 38, 18]]) { ell(ctx, x, y, r, r); fillStroke(ctx, rad(ctx, x, y, 2, r, [[0, '#a7f3b0'], [1, '#4fbf6a']], -6, -6), 2.5); }
      for (const [x, y] of [[36, 26], [60, 34], [22, 40]]) { ell(ctx, x, y, 3.5, 3.5); ctx.fillStyle = '#ff8fab'; ctx.fill(); }
    },
  },
  candyCane: {
    w: 30, h: 96,
    draw(ctx) {
      ctx.lineCap = 'round';
      const path = () => { ctx.beginPath(); ctx.moveTo(15, 92); ctx.lineTo(15, 22); ctx.arc(8, 22, 7, 0, Math.PI, true); };
      path(); ctx.lineWidth = 12; ctx.strokeStyle = INK; ctx.stroke();
      path(); ctx.lineWidth = 7; ctx.strokeStyle = '#fff'; ctx.stroke();
      ctx.setLineDash([6, 6]); path(); ctx.lineWidth = 7; ctx.strokeStyle = '#ff4d6d'; ctx.stroke(); ctx.setLineDash([]);
    },
  },
  railPost: {
    w: 16, h: 44,
    draw(ctx) {
      rr(ctx, 4, 6, 8, 36, 3); fillStroke(ctx, lin(ctx, 4, 0, 12, 0, [[0, '#ffffff'], [1, '#c7cbe0']]), 2.5);
      ell(ctx, 8, 7, 6, 5); fillStroke(ctx, '#ff5d8f', 2.5);
    },
  },
  cloud: {
    w: 220, h: 90,
    draw(ctx) {
      for (const [x, y, r] of [[60, 58, 30], [100, 42, 40], [150, 52, 34], [185, 64, 24], [35, 68, 20]]) { ell(ctx, x, y, r, r * 0.9); ctx.fillStyle = 'rgba(255,255,255,0.95)'; ctx.fill(); }
      ell(ctx, 110, 74, 92, 12); ctx.fillStyle = 'rgba(200,190,255,0.35)'; ctx.fill();
    },
  },
  sun: { w: 180, h: 180, draw(ctx) { ell(ctx, 90, 90, 88, 88); ctx.fillStyle = rad(ctx, 90, 90, 20, 88, [[0, 'rgba(255,245,200,1)'], [0.45, 'rgba(255,226,140,0.9)'], [1, 'rgba(255,200,120,0)']]); ctx.fill(); ell(ctx, 90, 90, 36, 36); ctx.fillStyle = '#fff6cf'; ctx.fill(); } },
  bubble: {
    w: 64, h: 50,
    draw(ctx) {
      rr(ctx, 3, 3, 58, 36, 16); fillStroke(ctx, '#ffffff', 3);
      ctx.beginPath(); ctx.moveTo(26, 38); ctx.lineTo(32, 48); ctx.lineTo(38, 38); fillStroke(ctx, '#ffffff', 3);
      rr(ctx, 6, 37, 52, 4, 2); ctx.fillStyle = '#ffffff'; ctx.fill();
    },
  },
  gumball: {
    w: 56, h: 56,
    draw(ctx) { ell(ctx, 28, 28, 25, 25); fillStroke(ctx, rad(ctx, 28, 28, 3, 26, [[0, '#ffd1ea'], [1, '#ff4fa3']], -8, -8)); shine(ctx, 19, 18, 7, 4, 0.8); for (const [x, y, c] of [[36, 34, '#ffd166'], [22, 38, '#4cc9f0'], [38, 20, '#06d6a0']]) { ell(ctx, x, y, 3, 3); ctx.fillStyle = c; ctx.fill(); } },
  },
  goo: { w: 40, h: 40, draw(ctx) { ell(ctx, 20, 20, 17, 17); fillStroke(ctx, rad(ctx, 20, 20, 2, 18, [[0, 'rgba(220,255,240,0.95)'], [1, 'rgba(120,230,190,0.75)']], -5, -5), 2, 'rgba(40,120,90,0.6)'); shine(ctx, 14, 13, 4, 2.5, 0.9); } },
  muzzle: { w: 30, h: 30, draw(ctx) { star(ctx, 15, 15, 14, 5, 6); ctx.fillStyle = 'rgba(255,240,180,1)'; ctx.fill(); ell(ctx, 15, 15, 5, 5); ctx.fillStyle = '#fff'; ctx.fill(); } },
};

// Badge icons for gate rewards
function iconWeapon(weapon) {
  return {
    w: 44, h: 44,
    draw(ctx) {
      const c = SUITS[weapon];
      ell(ctx, 22, 22, 20, 20); fillStroke(ctx, rad(ctx, 22, 22, 2, 21, [[0, shade(c.suit, 0.4)], [1, c.suit]], -5, -5), 2.5);
      ctx.save(); ctx.translate(-12, 6); ctx.scale(1, 1); drawGun(ctx, weapon, c); ctx.restore();
    },
  };
}
const ICONS = {
  iconFriends: {
    w: 44, h: 44,
    draw(ctx) {
      ell(ctx, 22, 22, 20, 20); fillStroke(ctx, rad(ctx, 22, 22, 2, 21, [[0, '#b8f7c8'], [1, '#22c55e']], -5, -5), 2.5);
      for (const [x, s] of [[14, 0.8], [30, 0.8], [22, 1]]) {
        ell(ctx, x, 18, 5 * s, 5 * s); fillStroke(ctx, '#3d8bff', 2);
        rr(ctx, x - 6 * s, 24, 12 * s, 10 * s, 5 * s); fillStroke(ctx, '#3d8bff', 2);
      }
    },
  },
  iconDouble: {
    w: 44, h: 44,
    draw(ctx) {
      ell(ctx, 22, 22, 20, 20); fillStroke(ctx, rad(ctx, 22, 22, 2, 21, [[0, '#fff3b0'], [1, '#f59e0b']], -5, -5), 2.5);
      ctx.fillStyle = '#7c2d12'; ctx.font = '900 19px Nunito, Arial, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('×2', 22, 23);
    },
  },
};

// ── Finish arch ──────────────────────────────────────────────────────────────
const ARCH = {
  arch: {
    w: 520, h: 300,
    draw(ctx) {
      for (const x of [30, 490]) {
        rr(ctx, x - 16, 70, 32, 228, 12); fillStroke(ctx, '#ffffff', 4);
        ctx.save(); rr(ctx, x - 16, 70, 32, 228, 12); ctx.clip();
        ctx.fillStyle = '#ff4d6d';
        for (let y = 50; y < 300; y += 36) { ctx.beginPath(); ctx.moveTo(x - 20, y); ctx.lineTo(x + 20, y - 22); ctx.lineTo(x + 20, y - 8); ctx.lineTo(x - 20, y + 14); ctx.fill(); }
        ctx.restore();
        ell(ctx, x, 66, 26, 26); fillStroke(ctx, rad(ctx, x, 66, 3, 26, [[0, '#fff3b0'], [1, '#ffb703']], -6, -6), 4);
      }
      rr(ctx, 40, 18, 440, 76, 30); fillStroke(ctx, lin(ctx, 0, 18, 0, 94, [[0, '#b388ff'], [1, '#7c3aed']]), 5);
      ctx.fillStyle = '#ffffff'; ctx.font = '900 50px Nunito, Arial, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.lineWidth = 8; ctx.strokeStyle = INK; ctx.strokeText('FINISH!', 260, 58); ctx.fillText('FINISH!', 260, 58);
      for (let i = 0; i < 9; i++) { star(ctx, 70 + i * 47.5, 104, 8, 3.5); fillStroke(ctx, CANDY[i % CANDY.length], 2); }
    },
  },
};

// ── Bosses (original designs, drawn in parts so they can animate) ────────────
const QUEEN = {
  queenWingL: { w: 170, h: 130, draw(ctx) { ell(ctx, 95, 65, 78, 50, -0.4); fillStroke(ctx, lin(ctx, 20, 20, 170, 120, [[0, 'rgba(230,220,255,0.85)'], [1, 'rgba(170,140,255,0.6)']]), 4); ctx.beginPath(); ctx.moveTo(160, 100); ctx.quadraticCurveTo(90, 70, 40, 40); ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(42,31,69,0.4)'; ctx.stroke(); } },
  queenBody: {
    w: 300, h: 300,
    draw(ctx) {
      for (const s of [-1, 1]) for (let i = 0; i < 3; i++) {
        ctx.beginPath(); ctx.lineCap = 'round'; ctx.lineWidth = 10; ctx.strokeStyle = INK;
        ctx.moveTo(150 + s * 60, 190 + i * 24); ctx.quadraticCurveTo(150 + s * 120, 200 + i * 24, 150 + s * 125, 260 + i * 10); ctx.stroke();
        ctx.lineWidth = 5; ctx.strokeStyle = '#6d28d9'; ctx.stroke();
      }
      ell(ctx, 150, 200, 96, 92); fillStroke(ctx, rad(ctx, 150, 200, 10, 100, [[0, '#d8b4fe'], [0.55, '#9b5de5'], [1, '#5b21b6']], -30, -30), 6);
      ctx.beginPath(); ctx.moveTo(150, 112); ctx.lineTo(150, 290); ctx.lineWidth = 5; ctx.strokeStyle = INK; ctx.stroke();
      for (const [x, y, r] of [[110, 190, 13], [190, 190, 13], [118, 240, 10], [182, 240, 10], [150, 270, 8]]) { ell(ctx, x, y, r, r); ctx.fillStyle = '#ffd166'; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = INK; ctx.stroke(); }
      shine(ctx, 105, 150, 26, 12, 0.5);
      rim(ctx, 150, 200, 88, 84, -2.8, -1.7, 6, 0.6);
      // head
      ell(ctx, 150, 108, 66, 54); fillStroke(ctx, rad(ctx, 150, 108, 6, 70, [[0, '#7c6aa8'], [1, '#3b2d63']], -20, -20), 6);
      for (const s of [-1, 1]) {
        ell(ctx, 150 + s * 26, 104, 20, 22); fillStroke(ctx, '#ffffff', 4);
        ell(ctx, 150 + s * 24, 110, 10, 12); ctx.fillStyle = INK; ctx.fill();
        ell(ctx, 150 + s * 21, 104, 4, 4); ctx.fillStyle = '#fff'; ctx.fill();
        ctx.beginPath(); ctx.lineWidth = 6; ctx.strokeStyle = INK; ctx.lineCap = 'round';
        ctx.moveTo(150 + s * 46, 76); ctx.lineTo(150 + s * 12, 86); ctx.stroke();
        ell(ctx, 150 + s * 46, 132, 9, 5); ctx.fillStyle = 'rgba(255,120,170,0.55)'; ctx.fill();
      }
      ctx.beginPath(); ctx.moveTo(130, 140); ctx.quadraticCurveTo(150, 128, 170, 140); ctx.lineWidth = 5; ctx.strokeStyle = INK; ctx.stroke();
      for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(150 + s * 22, 62); ctx.quadraticCurveTo(150 + s * 50, 20, 150 + s * 70, 34); ctx.lineWidth = 5; ctx.strokeStyle = INK; ctx.stroke(); ell(ctx, 150 + s * 70, 34, 9, 9); fillStroke(ctx, '#ff5d8f', 4); }
    },
  },
  queenCrown: {
    w: 140, h: 80,
    draw(ctx) {
      ctx.beginPath(); ctx.moveTo(14, 70); ctx.lineTo(10, 22); ctx.lineTo(40, 44); ctx.lineTo(70, 8); ctx.lineTo(100, 44); ctx.lineTo(130, 22); ctx.lineTo(126, 70); ctx.closePath();
      fillStroke(ctx, lin(ctx, 0, 8, 0, 70, [[0, '#fff3b0'], [0.5, '#ffd166'], [1, '#e09f00']]), 5);
      for (const [x, y, c] of [[70, 48, '#ff4d6d'], [36, 56, '#4cc9f0'], [104, 56, '#06d6a0']]) { ell(ctx, x, y, 8, 8); fillStroke(ctx, c, 3); }
      for (const x of [10, 70, 130]) { ell(ctx, x, x === 70 ? 8 : 22, 6, 6); fillStroke(ctx, '#fff', 3); }
    },
  },
};

const BONGO = {
  bongoArmL: {
    w: 120, h: 200,
    draw(ctx) {
      rr(ctx, 30, 10, 60, 150, 30); fillStroke(ctx, lin(ctx, 30, 0, 90, 0, [[0, '#f9a8d4'], [1, '#db2777']]), 6);
      ell(ctx, 60, 165, 42, 32); fillStroke(ctx, rad(ctx, 60, 165, 4, 44, [[0, '#f5d0fe'], [1, '#c084fc']], -10, -10), 6);
      for (let i = -1; i <= 1; i++) { ctx.beginPath(); ctx.moveTo(60 + i * 14, 150); ctx.lineTo(60 + i * 14, 175); ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(42,31,69,0.5)'; ctx.stroke(); }
      rim(ctx, 60, 85, 26, 72, -2.6, -1.9, 5, 0.6);
    },
  },
  bongoBody: {
    w: 340, h: 330,
    draw(ctx) {
      // fur torso
      ctx.beginPath(); ctx.moveTo(60, 320); ctx.quadraticCurveTo(20, 170, 110, 120); ctx.lineTo(230, 120); ctx.quadraticCurveTo(320, 170, 280, 320); ctx.closePath();
      fillStroke(ctx, rad(ctx, 170, 220, 20, 190, [[0, '#fbcfe8'], [0.6, '#f472b6'], [1, '#be185d']], -40, -50), 6);
      // fur tufts
      for (const [x, y] of [[70, 200], [270, 200], [90, 270], [250, 270]]) { ctx.beginPath(); ctx.moveTo(x - 14, y); ctx.lineTo(x, y - 18); ctx.lineTo(x + 14, y); ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(131,24,67,0.5)'; ctx.stroke(); }
      // chest (lilac)
      ell(ctx, 170, 225, 82, 72); fillStroke(ctx, rad(ctx, 170, 225, 6, 84, [[0, '#f5e8ff'], [1, '#c4b5fd']], -20, -20), 5);
      for (const s of [-1, 1]) { ell(ctx, 170 + s * 36, 215, 30, 24); ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(91,33,182,0.35)'; ctx.stroke(); }
      // head
      ell(ctx, 170, 110, 90, 80); fillStroke(ctx, rad(ctx, 170, 110, 8, 92, [[0, '#fbcfe8'], [1, '#db2777']], -30, -30), 6);
      ell(ctx, 170, 128, 62, 50); fillStroke(ctx, rad(ctx, 170, 128, 4, 62, [[0, '#faf5ff'], [1, '#d8b4fe']], -10, -14), 5);
      // sweatband
      rr(ctx, 84, 52, 172, 30, 14); fillStroke(ctx, '#ffffff', 5);
      ctx.save(); rr(ctx, 84, 52, 172, 30, 14); ctx.clip();
      ctx.fillStyle = '#22d3ee'; for (let x = 70; x < 270; x += 36) ctx.fillRect(x, 52, 16, 30);
      ctx.restore(); rr(ctx, 84, 52, 172, 30, 14); ctx.lineWidth = 5; ctx.strokeStyle = INK; ctx.stroke();
      // eyes, brows, nose, mouth
      for (const s of [-1, 1]) {
        ell(ctx, 170 + s * 30, 110, 17, 18); fillStroke(ctx, '#fff', 4);
        ell(ctx, 170 + s * 28, 114, 8, 10); ctx.fillStyle = INK; ctx.fill();
        ell(ctx, 170 + s * 25, 109, 3.5, 3.5); ctx.fillStyle = '#fff'; ctx.fill();
        ctx.beginPath(); ctx.moveTo(170 + s * 50, 88); ctx.lineTo(170 + s * 12, 98); ctx.lineWidth = 7; ctx.lineCap = 'round'; ctx.strokeStyle = INK; ctx.stroke();
        ell(ctx, 170 + s * 9, 140, 6, 4.5); ctx.fillStyle = 'rgba(91,33,182,0.7)'; ctx.fill();
        ell(ctx, 170 + s * 52, 148, 10, 6); ctx.fillStyle = 'rgba(255,120,170,0.55)'; ctx.fill();
      }
      ctx.beginPath(); ctx.moveTo(138, 160); ctx.quadraticCurveTo(170, 182, 202, 160); ctx.quadraticCurveTo(170, 168, 138, 160); fillStroke(ctx, '#ffffff', 4);
      // ears
      for (const s of [-1, 1]) { ell(ctx, 170 + s * 92, 116, 18, 22); fillStroke(ctx, '#f472b6', 5); ell(ctx, 170 + s * 92, 116, 9, 12); ctx.fillStyle = '#f5d0fe'; ctx.fill(); }
      rim(ctx, 170, 110, 84, 74, -2.6, -1.8, 6, 0.55);
    },
  },
  bongoCrown: {
    w: 200, h: 110,
    draw(ctx) {
      rr(ctx, 30, 70, 140, 30, 12); fillStroke(ctx, lin(ctx, 0, 70, 0, 100, [[0, '#fff3b0'], [1, '#f59e0b']]), 5);
      const pops = [[48, 34, '#ff5d8f'], [100, 22, '#4cc9f0'], [152, 34, '#06d6a0']];
      for (const [x, y, c] of pops) {
        rr(ctx, x - 3, y + 10, 6, 48, 3); fillStroke(ctx, '#fff', 3);
        ell(ctx, x, y, 22, 22); fillStroke(ctx, c, 4);
        ctx.save(); ell(ctx, x, y, 20, 20); ctx.clip();
        ctx.beginPath(); ctx.lineWidth = 5; ctx.strokeStyle = 'rgba(255,255,255,0.8)';
        for (let a = 0; a < 12; a += 0.2) { const r = a * 1.7; ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); }
        ctx.stroke(); ctx.restore();
      }
    },
  },
};

const REX = {
  rexTail: {
    w: 200, h: 120,
    draw(ctx) {
      ctx.beginPath(); ctx.moveTo(10, 80); ctx.quadraticCurveTo(80, 10, 190, 50); ctx.quadraticCurveTo(120, 60, 60, 110); ctx.closePath();
      fillStroke(ctx, lin(ctx, 0, 0, 200, 120, [[0, '#6ee7b7'], [1, '#10b981']]), 6);
    },
  },
  rexBody: {
    w: 340, h: 340,
    draw(ctx) {
      // candy crystal spikes (round gems along the back)
      const gems = [[70, 150, '#ff5d8f'], [92, 98, '#ffd166'], [130, 58, '#4cc9f0'], [210, 58, '#b388ff'], [248, 98, '#06d6a0'], [270, 150, '#ff9f1c']];
      for (const [x, y, c] of gems) {
        ctx.beginPath(); ctx.moveTo(x, y - 30); ctx.quadraticCurveTo(x + 24, y - 6, x + 14, y + 18); ctx.quadraticCurveTo(x, y + 26, x - 14, y + 18); ctx.quadraticCurveTo(x - 24, y - 6, x, y - 30);
        fillStroke(ctx, lin(ctx, x - 20, y - 30, x + 20, y + 26, [[0, shade(c, 0.55)], [0.5, c], [1, shade(c, -0.25)]]), 5);
        shine(ctx, x - 6, y - 8, 5, 9, 0.7);
      }
      // chubby body
      ell(ctx, 170, 225, 120, 108); fillStroke(ctx, rad(ctx, 170, 225, 14, 124, [[0, '#d1fae5'], [0.55, '#6ee7b7'], [1, '#059669']], -40, -40), 6);
      ell(ctx, 170, 250, 74, 72); fillStroke(ctx, rad(ctx, 170, 250, 6, 76, [[0, '#fffbeb'], [1, '#fde68a']], -14, -18), 5);
      for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.moveTo(118, 210 + i * 26); ctx.quadraticCurveTo(170, 222 + i * 26, 222, 210 + i * 26); ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(180,120,20,0.35)'; ctx.stroke(); }
      // feet
      for (const s of [-1, 1]) { ell(ctx, 170 + s * 72, 322, 40, 18); fillStroke(ctx, '#34d399', 5); for (let k = -1; k <= 1; k++) { ell(ctx, 170 + s * 72 + k * 14, 330, 6, 5); fillStroke(ctx, '#fff', 2.5); } }
      // head
      ell(ctx, 170, 120, 98, 78); fillStroke(ctx, rad(ctx, 170, 120, 10, 100, [[0, '#d1fae5'], [1, '#10b981']], -30, -30), 6);
      ell(ctx, 170, 152, 70, 34); fillStroke(ctx, rad(ctx, 170, 152, 4, 70, [[0, '#ecfdf5'], [1, '#a7f3d0']]), 5);
      for (const s of [-1, 1]) {
        ell(ctx, 170 + s * 40, 106, 26, 28); fillStroke(ctx, '#fff', 5);
        ell(ctx, 170 + s * 37, 112, 13, 16); ctx.fillStyle = '#1e3a8a'; ctx.fill();
        ell(ctx, 170 + s * 37, 114, 7, 9); ctx.fillStyle = INK; ctx.fill();
        ell(ctx, 170 + s * 32, 104, 5, 5); ctx.fillStyle = '#fff'; ctx.fill();
        ctx.beginPath(); ctx.moveTo(170 + s * 70, 72); ctx.quadraticCurveTo(170 + s * 40, 70, 170 + s * 16, 86); ctx.lineWidth = 8; ctx.lineCap = 'round'; ctx.strokeStyle = INK; ctx.stroke();
        ell(ctx, 170 + s * 72, 140, 12, 7); ctx.fillStyle = 'rgba(255,120,170,0.5)'; ctx.fill();
        ell(ctx, 170 + s * 14, 140, 4, 3); ctx.fillStyle = 'rgba(6,95,70,0.8)'; ctx.fill();
      }
      ctx.beginPath(); ctx.moveTo(128, 162); ctx.quadraticCurveTo(170, 186, 212, 162); ctx.lineWidth = 5; ctx.strokeStyle = INK; ctx.stroke();
      for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(170 + s * 22, 166); ctx.lineTo(170 + s * 18, 176); ctx.lineTo(170 + s * 12, 168); fillStroke(ctx, '#fff', 2.5); }
      rim(ctx, 170, 120, 90, 70, -2.7, -1.8, 6, 0.55);
    },
  },
  rexArm: {
    w: 80, h: 70,
    draw(ctx) {
      ell(ctx, 40, 32, 30, 20, 0.3); fillStroke(ctx, lin(ctx, 10, 10, 70, 50, [[0, '#a7f3d0'], [1, '#10b981']]), 5);
      for (let k = 0; k < 3; k++) { ell(ctx, 58 + k * 2, 22 + k * 12, 6, 5); fillStroke(ctx, '#fff', 2.5); }
    },
  },
};

// ── Catalogue ────────────────────────────────────────────────────────────────
export const WEAPON_KEYS = Object.keys(SUITS);
export const SPECIES_KEYS = ['beetle', 'bee', 'snail', 'spiderbot'];

/** Everything for the main atlas */
export function mainArt() {
  const out = { ...ITEMS, ...ICONS };
  for (const wp of WEAPON_KEYS) {
    for (let f = 0; f < 4; f++) out[`soldier_${wp}_${f}`] = soldier(wp, f);
    if (wp !== 'blaster') out[`icon_${wp}`] = iconWeapon(wp);
  }
  for (const sp of SPECIES_KEYS) {
    for (let f = 0; f < 2; f++) {
      out[`bug_${sp}_${f}`] = bug(sp, f, false);
      out[`bug_${sp}_${f}_angry`] = bug(sp, f, true);
    }
    out[`pupils_${sp}`] = pupils(sp);
  }
  return out;
}
/** Bosses + arch (big pieces) go in their own atlas */
export function bigArt() {
  return { ...ARCH, ...QUEEN, ...BONGO, ...REX };
}
