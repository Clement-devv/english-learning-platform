// src/pages/games/word-squad/render/renderer.js
// Draws the world from logic/world.js with PixiJS: sky and city parallax, the
// perspective road, scenery, the squad, bugs, crates, gates, the boss, bullets
// and the laser. Effects for world events live in fx.js.
import { Application, BitmapFont, BitmapText, CanvasSource, Container, Graphics, Sprite, Texture } from 'pixi.js';
import { project, depthScale, LOGICAL_H, PORTRAIT_W, horizonY, PX_PER_UNIT, X_K } from '../logic/projection.js';
import { ROAD_HALF, VIEW_DIST, PARTICLE_CAP, BOSS_HOLD_Z } from '../logic/config.js';
import { formation, laneIndex } from '../logic/squad.js';
import { buildAtlases } from './atlas.js';
import { createParticles } from './particles.js';
import { createGateView } from './gateView.js';
import { createBossView } from './bossView.js';
import { createRoadView } from './roadView.js';
import { BUG_EYES, CANDY_COLORS } from './art.js';

const FONT = 'Nunito';
const BUG_SCALE = 1.45;
const MINI_SCALE = 3.0;
const BOSS_SCALE = 2.6;
const fade = (rz) => Math.max(0, Math.min(1, (VIEW_DIST + 1.2 - rz) / 2.2));

/** Keep one display object per entity id; release the ones whose entity is gone. */
function keyed(create, release) {
  const map = new Map();
  let frame = 0;
  return {
    get(id, ...args) {
      let v = map.get(id);
      if (!v) { v = { o: create(...args) }; map.set(id, v); }
      v.f = frame;
      return v.o;
    },
    sweep() {
      for (const [id, v] of map) if (v.f !== frame) { release(v.o); map.delete(id); }
      frame++;
    },
    clear() { for (const v of map.values()) release(v.o); map.clear(); },
  };
}

function makeCanvasTexture(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  return new Texture({ source: new CanvasSource({ resource: c, scaleMode: 'linear' }) });
}

function skyline(w, h, layer) {
  return makeCanvasTexture(w, h, (ctx) => {
    const cols = layer === 'far' ? ['#c9b8ff', '#b8c6ff', '#d6c4ff', '#bcd4ff'] : ['#ff9ec7', '#8fd3ff', '#b69cff', '#7fe0c0', '#ffc38f'];
    let x = 0, i = 0;
    while (x < w) {
      const bw = (layer === 'far' ? 50 : 70) + ((i * 37) % 60);
      const bh = (layer === 'far' ? 60 : 50) + ((i * 53) % (layer === 'far' ? 110 : 90));
      ctx.fillStyle = cols[i % cols.length];
      const top = h - bh;
      ctx.beginPath();
      if (i % 3 === 0) { ctx.moveTo(x, h); ctx.lineTo(x, top + 18); ctx.quadraticCurveTo(x + bw / 2, top - 18, x + bw, top + 18); ctx.lineTo(x + bw, h); }
      else { ctx.roundRect(x, top, bw - 4, bh + 10, [14, 14, 0, 0]); }
      ctx.fill();
      if (layer === 'near') {
        ctx.fillStyle = 'rgba(255,255,255,0.55)';
        for (let wy = top + 14; wy < h - 12; wy += 20) for (let wx = x + 10; wx < x + bw - 16; wx += 16) ctx.fillRect(wx, wy, 7, 9);
      }
      x += bw - 2;
      i++;
    }
  });
}

export async function createRenderer({ host, device, reducedMotion }) {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const app = new Application();
  await app.init({
    preference: ['webgl', 'canvas'],
    background: 0xbfe3ff,
    antialias: device === 'desktop',
    resolution: dpr,
    autoDensity: true,
    width: host.clientWidth || PORTRAIT_W,
    height: host.clientHeight || LOGICAL_H,
    powerPreference: 'high-performance',
  });
  app.ticker.stop(); // the engine drives frames
  app.canvas.style.display = 'block';
  app.canvas.style.width = '100%';
  app.canvas.style.height = '100%';
  app.canvas.style.touchAction = 'none';
  host.appendChild(app.canvas);

  try { await document.fonts?.load?.(`900 40px ${FONT}`); } catch { /* fall back to system fonts */ }
  BitmapFont.install({
    name: 'WSNum',
    style: { fontFamily: `${FONT}, Arial, sans-serif`, fontSize: 48, fontWeight: '900', fill: 0xffffff, stroke: { color: 0x2a1f45, width: 8, join: 'round' } },
    chars: [['0', '9'], '+-×x!/ '],
    resolution: 1.5,
    padding: 6,
  });
  BitmapFont.install({
    name: 'WSComic',
    style: { fontFamily: `${FONT}, Arial, sans-serif`, fontSize: 64, fontWeight: '900', fill: 0xffe066, stroke: { color: 0x2a1f45, width: 10, join: 'round' } },
    chars: [['A', 'Z'], ['0', '9'], ' !+-×?.'],
    resolution: 1.5,
    padding: 8,
  });
  BitmapFont.install({
    name: 'WSDark',
    style: { fontFamily: `${FONT}, Arial, sans-serif`, fontSize: 40, fontWeight: '900', fill: 0x2a1f45 },
    chars: [['0', '9']],
    resolution: 1.5,
    padding: 4,
  });

  const atlas = buildAtlases(device === 'phone' ? 'low' : 'high');
  const baseCap = PARTICLE_CAP[device] * (reducedMotion ? 0.5 : 1);

  // ── Layers ─────────────────────────────────────────────────────────────────
  const root = new Container();
  const cam = new Container();
  const bg = new Container();
  const ground = new Graphics();
  const tele = new Graphics();
  const shadows = new Container();
  const world = new Container();
  world.sortableChildren = true;
  const beam = new Graphics();
  beam.blendMode = 'add';
  const particles = createParticles(atlas, baseCap);
  const labels = new Container();
  const hud = new Container();
  cam.addChild(bg, ground, tele, shadows, world, beam, particles.layer, labels);
  root.addChild(cam, hud);
  app.stage.addChild(root);

  // ── Background ─────────────────────────────────────────────────────────────
  const skyTex = makeCanvasTexture(4, 512, (ctx, w, h) => {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#7cc4ff'); g.addColorStop(0.55, '#bfe3ff'); g.addColorStop(0.85, '#ffe0f0'); g.addColorStop(1, '#fff1d6');
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  });
  const sky = new Sprite(skyTex);
  const sunArt = atlas.get('sun');
  const sun = new Sprite(sunArt.texture);
  sun.anchor.set(0.5);
  sun.scale.set(sunArt.inv);
  const farTex = skyline(1024, 200, 'far');
  const nearTex = skyline(1024, 160, 'near');
  const far = [0, 1, 2].map(() => new Sprite(farTex));
  const near = [0, 1, 2].map(() => new Sprite(nearTex));
  const clouds = [];
  const cloudLayer = new Container();
  bg.addChild(sky, sun, ...far, cloudLayer, ...near);
  for (let i = 0; i < 6; i++) {
    const art = atlas.get('cloud');
    const c = new Sprite(art.texture);
    c.anchor.set(0.5);
    const k = 0.5 + (i % 3) * 0.25;
    c.scale.set(art.inv * k);
    c.alpha = 0.85;
    clouds.push({ s: c, speed: 6 + k * 10, y: 60 + (i * 47) % 170, x: i * 330 });
    cloudLayer.addChild(c);
  }

  // ── Sizing ─────────────────────────────────────────────────────────────────
  let W = PORTRAIT_W, H = LOGICAL_H, top = 0;
  let resolution = dpr;
  function resize() {
    const cw = Math.max(1, host.clientWidth), ch = Math.max(1, host.clientHeight);
    app.renderer.resize(cw, ch, resolution);
    // Fit the height: on a narrow phone the road runs off both edges, so the action
    // fills the screen (a close, over-the-shoulder view) instead of shrinking
    const scale = ch / LOGICAL_H;
    W = cw / scale;
    H = ch / scale;
    top = -(H - LOGICAL_H);              // extra height on tall phones goes to the sky
    root.scale.set(scale);
    root.y = ch - LOGICAL_H * scale;
    sky.position.set(0, top);
    sky.width = W; sky.height = horizonY - top + 40;
    sun.position.set(W * 0.78, horizonY - 170);
    far.forEach((s) => { s.y = horizonY - 196; });
    near.forEach((s) => { s.y = horizonY - 150; });
  }
  resize();

  // ── Entity views ───────────────────────────────────────────────────────────
  const tex = (name) => atlas.get(name);
  function sprite(name, ax = 0.5, ay = 1) {
    const art = tex(name);
    const s = new Sprite(art.texture);
    s.anchor.set(ax, ay);
    s._inv = art.inv;
    return s;
  }
  const setTex = (s, name) => { const art = tex(name); if (s.texture !== art.texture) s.texture = art.texture; s._inv = art.inv; };

  const shadowPool = [];
  const shadowOf = () => { const s = shadowPool.pop() || sprite('shadow', 0.5, 0.5); shadows.addChild(s); s.visible = true; return s; };
  const releaseShadow = (s) => { s.visible = false; shadows.removeChild(s); shadowPool.push(s); };

  const bugs = keyed(
    (species, kind) => {
      const c = new Container();
      const body = sprite(`bug_${species}_0`);
      const eyes = sprite(`pupils_${species}`);
      c.addChild(body, eyes);
      let hp = null;
      if (kind === 'mini') {
        hp = new BitmapText({ text: '', style: { fontFamily: 'WSNum', fontSize: 30 } });
        hp.anchor.set(0.5, 1);
        labels.addChild(hp);
      }
      world.addChild(c);
      return { c, body, eyes, hp, shadow: shadowOf(), shown: -1 };
    },
    (v) => { v.c.destroy({ children: true }); v.hp?.destroy(); releaseShadow(v.shadow); },
  );
  const crates = keyed(
    () => {
      const s = sprite('crate');
      const hp = new BitmapText({ text: '', style: { fontFamily: 'WSNum', fontSize: 28 } });
      hp.anchor.set(0.5, 1);
      world.addChild(s);
      labels.addChild(hp);
      return { s, hp, shadow: shadowOf(), shown: -1 };
    },
    (v) => { v.s.destroy(); v.hp.destroy(); releaseShadow(v.shadow); },
  );
  const bulletPool = [];
  const bullets = keyed(
    (weapon) => {
      const s = bulletPool.pop() || new Sprite();
      setTex(s, weapon === 'rockets' ? 'rocket' : 'tracer');
      s.anchor.set(0.5, 0.15);
      s.tint = { blaster: 0x9be7ff, double: 0x7dfcf0, minigun: 0xffd166, rockets: 0xffffff }[weapon] ?? 0xffffff;
      s.blendMode = weapon === 'rockets' ? 'normal' : 'add';
      s.visible = true;
      s._smoke = 0;
      world.addChild(s);
      return s;
    },
    (s) => { s.visible = false; world.removeChild(s); bulletPool.push(s); },
  );
  const gates = keyed(
    (g, weapon, total) => { const v = createGateView(atlas, g, weapon, total); world.addChild(v.root); labels.addChild(v.banner); return v; },
    (v) => v.destroy(),
  );

  const roadView = createRoadView({ world, labels, particles, keyed, sprite, shadowOf, releaseShadow, fade, proj: (x, rz) => project(x, rz, W) });

  // Squad: a fixed set of soldier sprites
  const soldiers = [];
  for (let i = 0; i < 40; i++) {
    const s = sprite('soldier_blaster_0');
    s.visible = false;
    world.addChild(s);
    const sh = sprite('shadow', 0.5, 0.5);
    sh.visible = false;
    shadows.addChild(sh);
    soldiers.push({ s, sh, flash: 0 });
  }
  const bubble = sprite('bubble', 0.5, 1);
  const countText = new BitmapText({ text: '0', style: { fontFamily: 'WSDark', fontSize: 30 } });
  countText.anchor.set(0.5, 0.5);
  labels.addChild(bubble, countText);

  // Scenery: props on both sides and rail posts along the road
  const props = [];
  let nextPropZ = -1;
  let nextPostZ = -1;
  const propNames = ['lollipopTree', 'gumTree', 'bush', 'candyCane', 'gumTree', 'bush'];
  let seed = 9;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  function addProp(name, x, z, scale) {
    const s = sprite(name);
    s._k = scale;
    world.addChild(s);
    const sh = name === 'railPost' ? null : shadowOf();
    props.push({ s, sh, x, z });
  }
  function updateScenery(dist) {
    const reach = dist + VIEW_DIST + 1;
    const spread = Math.max(2.2, ((W / 2) * 2.4) / X_K); // wider screens show more of the sides
    while (nextPropZ < reach) {
      for (const side of [-1, 1]) {
        const n = 1 + Math.floor(rnd() * Math.min(3, spread));
        for (let k = 0; k < n; k++) addProp(propNames[Math.floor(rnd() * propNames.length)], side * (ROAD_HALF + 0.55 + rnd() * spread), nextPropZ + rnd() * 1.2, 0.85 + rnd() * 0.4);
      }
      nextPropZ += 1.5;
    }
    while (nextPostZ < reach) {
      for (const side of [-1, 1]) addProp('railPost', side * (ROAD_HALF + 0.12), nextPostZ, 1);
      nextPostZ += 0.9;
    }
    let j = 0;
    for (const p of props) {
      const rz = p.z - dist;
      if (rz < -1.2) { p.s.destroy(); if (p.sh) releaseShadow(p.sh); continue; }
      const q = project(p.x, rz, W);
      p.s.position.set(q.x, q.y);
      p.s.scale.set(q.s * p.s._k * p.s._inv);
      p.s.alpha = fade(rz);
      p.s.zIndex = Math.round(-rz * 100);
      p.s.visible = q.x > -200 && q.x < W + 200;
      if (p.sh) { p.sh.position.set(q.x, q.y); p.sh.scale.set(q.s * 1.4 * p.sh._inv, q.s * 1.2 * p.sh._inv); p.sh.alpha = fade(rz) * 0.7; }
      props[j++] = p;
    }
    props.length = j;
  }

  // Finish arch and boss
  let arch = null;
  let bossView = null;

  // ── Ground (drawn every frame) ─────────────────────────────────────────────
  function quad(g, x0, x1, rz0, rz1, color, alpha = 1) {
    const a = project(x0, rz0, W), b = project(x1, rz0, W), c = project(x1, rz1, W), d = project(x0, rz1, W);
    g.poly([a.x, a.y, b.x, b.y, c.x, c.y, d.x, d.y]).fill({ color, alpha });
  }
  function drawGround(dist) {
    const g = ground;
    g.clear();
    g.rect(0, horizonY - 2, W, LOGICAL_H - horizonY + 400).fill(0x8fe39b);
    const band = 0.8;
    const k0 = Math.floor((dist - 1.6) / band);
    for (let k = k0; k * band < dist + VIEW_DIST + 2; k++) {
      const rz0 = Math.max(-1.6, k * band - dist), rz1 = (k + 1) * band - dist;
      if (rz1 <= -1.6) continue;
      const y0 = project(0, rz0, W).y, y1 = project(0, rz1, W).y;
      if (k % 2) g.rect(0, y1, W, y0 - y1).fill(0x7fd88f);
      quad(g, -ROAD_HALF, ROAD_HALF, rz0, rz1, k % 2 ? 0x9b95bf : 0xa6a0c9);
      const curb = k % 2 ? 0xff5d8f : 0xffffff;
      quad(g, -ROAD_HALF - 0.09, -ROAD_HALF, rz0, rz1, curb);
      quad(g, ROAD_HALF, ROAD_HALF + 0.09, rz0, rz1, curb);
    }
    // lane marks (dashes) splitting the road in three
    const dash = 1.0;
    const d0 = Math.floor((dist - 1.6) / dash);
    for (let k = d0; k * dash < dist + VIEW_DIST; k++) {
      const rz0 = k * dash - dist, rz1 = rz0 + 0.45;
      if (rz1 < -1.6) continue;
      for (const lx of [-ROAD_HALF / 3, ROAD_HALF / 3]) quad(g, lx - 0.025, lx + 0.025, Math.max(-1.6, rz0), rz1, 0xffffff, 0.75);
    }
    // rail tops
    for (const side of [-1, 1]) {
      const x = side * (ROAD_HALF + 0.12);
      const pts = [];
      for (let rz = -1.4; rz <= VIEW_DIST; rz += 0.7) { const q = project(x, rz, W); pts.push(q.x, q.y - 36 * q.s); }
      g.moveTo(pts[0], pts[1]);
      for (let i = 2; i < pts.length; i += 2) g.lineTo(pts[i], pts[i + 1]);
      g.stroke({ width: 5, color: 0xffffff, alpha: 0.9 });
    }
    // haze at the horizon
    g.rect(0, horizonY - 4, W, 26).fill({ color: 0xffffff, alpha: 0.35 });
  }

  // ── Telegraphs (boss attack warnings on the road) ─────────────────────────
  function drawTelegraphs(w, t, sweeps) {
    const g = tele;
    g.clear();
    const bossRz = w.boss ? w.boss.z - w.dist : BOSS_HOLD_Z;
    for (const tg of w.telegraphs) {
      const flying = tg.state === 'flying';
      const urgency = flying ? 1 : 1 - tg.t / tg.dur;
      const pulse = 0.5 + 0.5 * Math.sin(t * (10 + urgency * 26));
      const alpha = flying ? 0.22 : 0.3 + 0.4 * pulse;
      if (tg.shape === 'lane') {
        const col = tg.harmless ? 0xb388ff : tg.kind === 'goo' ? 0x34d399 : 0xff3b5c;
        quad(g, tg.x0, tg.x1, -0.6, bossRz, col, alpha);
        quad(g, tg.x0, tg.x0 + 0.05, -0.6, bossRz, 0xffffff, 0.5 + 0.5 * pulse);
        quad(g, tg.x1 - 0.05, tg.x1, -0.6, bossRz, 0xffffff, 0.5 + 0.5 * pulse);
        // the attack itself racing toward the squad: a bright band with a glowing front
        if (flying && !tg.harmless) { quad(g, tg.x0, tg.x1, tg.prz - 0.9, tg.prz, 0xffffff, 0.5); quad(g, tg.x0, tg.x1, tg.prz - 0.12, tg.prz + 0.08, 0xffd166, 0.95); }
      } else if (tg.shape === 'circle') {
        const q = project(tg.cx, tg.rz, W);
        const rx = tg.r * PX_PER_UNIT * q.s * (flying ? 0.5 + 0.5 * Math.min(1, tg.ft / tg.flight) : 1);
        g.ellipse(q.x, q.y, rx, rx * 0.38).fill({ color: 0xff3b5c, alpha });
        g.ellipse(q.x, q.y, rx * (1.15 - urgency * 0.15), rx * 0.38 * (1.15 - urgency * 0.15)).stroke({ width: 4, color: 0xffffff, alpha: 0.9 });
      } else if (tg.shape === 'wave') {
        quad(g, -ROAD_HALF, tg.gx0, -0.6, bossRz, 0xff3b5c, alpha);
        quad(g, tg.gx1, ROAD_HALF, -0.6, bossRz, 0xff3b5c, alpha);
        quad(g, tg.gx0, tg.gx1, -0.6, bossRz, 0x22c55e, 0.25 + 0.2 * pulse);
        if (flying) { quad(g, -ROAD_HALF, tg.gx0, tg.prz - 0.5, tg.prz, 0xffb703, 0.8); quad(g, tg.gx1, ROAD_HALF, tg.prz - 0.5, tg.prz, 0xffb703, 0.8); }
      }
    }
    // Attack sweeps travelling from the boss toward the squad
    for (const s of sweeps) {
      const k = s.age / s.life;
      const rzHead = bossRz - (bossRz + 0.8) * k;
      const col = s.color;
      if (s.shape === 'wave') {
        quad(g, -ROAD_HALF, s.gx0, rzHead - 0.5, rzHead, col, 0.8 * (1 - k * 0.5));
        quad(g, s.gx1, ROAD_HALF, rzHead - 0.5, rzHead, col, 0.8 * (1 - k * 0.5));
      } else if (s.shape === 'lane') {
        quad(g, s.x0, s.x1, rzHead - 0.6, rzHead, col, 0.85 * (1 - k * 0.5));
      }
    }
  }

  // ── Per-frame sync ─────────────────────────────────────────────────────────
  let shownCount = -1;
  function draw(w, t, dt, view) {
    const dist = w.dist;
    // background motion
    const par = -w.squad.x * 18;
    const wrap = (v) => (((v % 3072) + 3072) % 3072) - 1024;
    far.forEach((s, i) => { s.x = wrap(par * 0.5 + i * 1024 + (W - 1024) / 2); });
    near.forEach((s, i) => { s.x = wrap(par + i * 1024 + 300 + (W - 1024) / 2); });
    const skyTop = top + 40, skyBottom = horizonY - 90;
    for (const c of clouds) {
      c.x += c.speed * dt;
      if (c.x > W + 200) c.x = -200;
      c.s.position.set(c.x + par * 0.3, skyTop + (c.y / 230) * Math.max(0, skyBottom - skyTop));
    }

    drawGround(dist);
    drawTelegraphs(w, t, view.sweeps);
    updateScenery(dist);

    // bugs + mini-bosses
    const sx = w.squad.x;
    for (const e of w.enemies) {
      const v = bugs.get(e.id, e.species, e.kind);
      const rz = e.z - dist;
      const q = project(e.x, rz, W);
      const frame = Math.floor(t * 6 + e.phase) % 2;
      setTex(v.body, `bug_${e.species}_${frame}${e.angry ? '_angry' : ''}`);
      const size = (e.kind === 'mini' ? MINI_SCALE : BUG_SCALE) * q.s;
      const hover = e.species === 'bee' ? (Math.sin(t * 7 + e.phase) * 5 - 12) * q.s : 0;
      v.c.position.set(q.x, q.y + hover);
      // a shooting bug swells and glows green just before it spits — the warning to dodge
      const aiming = e.shooter && e.aimX !== null;
      const pop = (e.flashT > 0 ? 1.12 : 1) * (aiming ? 1.18 + Math.sin(t * 30) * 0.06 : 1);
      v.body.tint = e.shooter ? (aiming ? 0xd9ff8a : 0xd4f5b0) : 0xffffff;
      v.body.scale.set(size * v.body._inv * pop);
      v.eyes.scale.set(size * v.eyes._inv * pop);
      // eyes follow the squad
      const look = Math.max(-1, Math.min(1, (sx - e.x) * 1.5));
      v.eyes.position.set(look * 2.2 * size, 1.5 * size);
      v.c.zIndex = Math.round(-rz * 100) + 1;
      v.c.alpha = fade(rz);
      v.shadow.position.set(q.x, q.y);
      v.shadow.scale.set(size * v.shadow._inv * 0.9, size * v.shadow._inv * 0.8);
      v.shadow.alpha = fade(rz) * (e.species === 'bee' ? 0.5 : 0.8);
      if (v.hp) {
        const hp = Math.ceil(e.hp);
        if (hp !== v.shown) { v.shown = hp; v.hp.text = String(hp); }
        v.hp.position.set(q.x, q.y - 66 * size);
        v.hp.scale.set(Math.max(0.5, q.s * 1.3));
        v.hp.alpha = fade(rz);
      }
    }
    bugs.sweep();

    for (const c of w.crates) {
      const v = crates.get(c.id);
      const rz = c.z - dist;
      const q = project(c.x, rz, W);
      v.s.position.set(q.x, q.y);
      v.s.scale.set(q.s * v.s._inv * (c.flashT > 0 ? 1.1 : 1));
      v.s.zIndex = Math.round(-rz * 100);
      v.s.alpha = fade(rz);
      v.shadow.position.set(q.x, q.y);
      v.shadow.scale.set(q.s * v.shadow._inv * 1.1, q.s * v.shadow._inv);
      const hp = Math.ceil(c.hp);
      if (hp !== v.shown) { v.shown = hp; v.hp.text = String(hp); }
      v.hp.position.set(q.x, q.y - 70 * q.s);
      v.hp.scale.set(Math.max(0.45, q.s * 1.2));
      v.hp.alpha = fade(rz);
    }
    crates.sweep();

    for (const b of w.bullets) {
      const s = bullets.get(b.id, b.weapon);
      const rz = b.z - dist;
      const q = project(b.x, rz, W);
      const lift = 30 * q.s;
      s.position.set(q.x, q.y - lift);
      const q2 = project(b.x + b.vx * 0.05, rz + b.vz * 0.05, W);
      s.rotation = Math.atan2(q2.y - q.y, q2.x - q.x) + Math.PI / 2;
      s.scale.set(q.s * s._inv * (b.weapon === 'minigun' ? 0.8 : 1.1));
      s.zIndex = Math.round(-rz * 100) + 2;
      if (b.weapon === 'rockets') {
        s._smoke -= dt;
        if (s._smoke <= 0) {
          s._smoke = 0.035;
          particles.emit('smoke', q.x, q.y - lift + 10 * q.s, { scale: q.s * 0.35, scaleTo: q.s * 0.9, life: 0.45, alpha: 0.7, vy: -20, tint: 0xf1f1f6 });
        }
      }
    }
    bullets.sweep();

    roadView.draw(w, t, dt, view);

    // gates
    const active = w.activeGate();
    for (const g of w.gates) {
      const v = gates.get(g.id, g, w.squad.weapon, w.plan.gates);
      const rz = g.z - dist;
      const q = project(0, rz, W);
      v.root.position.set(q.x, q.y);
      v.root.scale.set(q.s);
      v.root.zIndex = Math.round(-rz * 100) - 5;
      v.root.alpha = fade(rz) * (rz < 0 ? Math.max(0, 1 + rz / 1.2) : 1);
      v.update(g, w.squad.weapon, g === active ? laneIndex(sx, g.n) : -1);
      // The question hangs above its gate; kept big enough to read while the gate is far away
      v.banner.visible = v.banner.visible && g === active;
      if (v.banner.visible) {
        const bs = Math.max(0.62, Math.min(1, q.s * 1.9));
        const h = v.banner.pivot.y * bs;
        v.banner.scale.set(bs);
        v.banner.position.set(q.x, Math.max(top + 70 + h, q.y + v.bannerAnchorY * q.s));
        v.banner.alpha = Math.min(1, fade(rz) * 1.5);
      }
    }
    gates.sweep();

    // squad
    const count = w.squad.count;
    const spots = formation(count);
    const weapon = w.squad.weapon;
    for (let i = 0; i < soldiers.length; i++) {
      const v = soldiers[i];
      const p = spots[i];
      if (!p) { v.s.visible = false; v.sh.visible = false; continue; }
      const q = project(sx + p.dx, p.dz, W);
      const frame = Math.floor(t * 9 + i * 0.37) % 4;
      setTex(v.s, `soldier_${weapon}_${frame}`);
      v.s.visible = true;
      v.s.position.set(q.x, q.y + Math.abs(Math.sin(t * 9 + i)) * -2 * q.s);
      v.s.scale.set(q.s * v.s._inv * 1.1);
      v.s.zIndex = Math.round(-p.dz * 100) + 3;
      v.s.tint = view.hurtT > 0 ? 0xff9a9a : 0xffffff;
      v.sh.visible = true;
      v.sh.position.set(q.x, q.y);
      v.sh.scale.set(q.s * v.sh._inv * 0.6, q.s * v.sh._inv * 0.55);
    }
    const head = project(sx, 0.3, W);
    bubble.visible = countText.visible = count > 0;
    bubble.position.set(head.x, head.y - 92);
    bubble.scale.set(bubble._inv * (1 + view.bubblePop * 0.3));
    countText.position.set(head.x, head.y - 92 - 29);
    countText.scale.set(1 + view.bubblePop * 0.3);
    if (count !== shownCount) { shownCount = count; countText.text = String(count); }

    // laser
    beam.clear();
    if (w.beam && count > 0) {
      const a = project(w.beam.x, 0.25, W), b = project(w.beam.x, w.beam.range, W);
      const flick = 0.85 + Math.random() * 0.15;
      const ay = a.y - 40, by = b.y - 30 * b.s;
      if (view.quality < 2) beam.moveTo(a.x, ay).lineTo(b.x, by).stroke({ width: 34 * flick, color: 0xff4fa3, alpha: 0.25 });
      beam.moveTo(a.x, ay).lineTo(b.x, by).stroke({ width: 16 * flick, color: 0xff79c6, alpha: 0.75 });
      beam.moveTo(a.x, ay).lineTo(b.x, by).stroke({ width: 5, color: 0xffffff, alpha: 1 });
      beam.circle(a.x, ay, 14 * flick).fill({ color: 0xffd1ea, alpha: 0.9 });
    }

    // boss
    if (w.boss && w.boss.state !== 'dead') {
      if (!bossView) {
        bossView = createBossView(atlas, w.boss.kind, w.boss.name);
        world.addChild(bossView.root);
        labels.addChild(bossView.hud);
      }
      const rz = w.boss.z - dist;
      const q = project(w.boss.x, rz, W);
      bossView.root.position.set(q.x, q.y);
      bossView.root.scale.set(q.s * BOSS_SCALE);
      bossView.root.zIndex = Math.round(-rz * 100);
      bossView.update(w.boss, t, dt, w.boss.windup?.kind || null);
      bossView.hud.position.set(q.x, q.y + bossView.top * q.s * BOSS_SCALE - 14);
      view.bossScreen = { x: q.x, y: q.y, s: q.s * BOSS_SCALE, top: bossView.top };
    } else if (bossView && (!w.boss || w.boss.state === 'dead')) {
      bossView.destroy();
      bossView = null;
    }

    // finish arch
    if (w.archZ !== null) {
      if (!arch) { arch = sprite('arch'); world.addChild(arch); }
      const rz = w.archZ - dist;
      const q = project(0, rz, W);
      arch.position.set(q.x, q.y + 4 * q.s);
      arch.scale.set(q.s * arch._inv * 1.02); // its posts stand just outside the road
      arch.zIndex = Math.round(-rz * 100) - 3;
      arch.alpha = rz < -0.4 ? 0 : 1;
    }
  }

  return {
    app, atlas, particles, labels, hud, cam, root,
    get W() { return W; }, get H() { return H; }, get top() { return top; },
    resize,
    draw,
    proj: (x, rz) => project(x, rz, W),
    depthScale,
    candy: CANDY_COLORS,
    eyes: BUG_EYES,
    setQuality(level) {
      particles.setLimit(Math.round(baseCap * (level === 0 ? 1 : level === 1 ? 0.6 : 0.4)));
      const res = level >= 2 ? Math.max(0.75, dpr * 0.75) : dpr;
      if (res !== resolution) { resolution = res; resize(); }
    },
    render() { app.renderer.render(app.stage); },
    destroy() {
      bugs.clear(); crates.clear(); bullets.clear(); gates.clear(); roadView.destroy();
      bossView?.destroy();
      atlas.destroy();
      for (const n of ['WSNum', 'WSComic', 'WSDark']) { try { BitmapFont.uninstall(n); } catch { /* ignore */ } }
      app.destroy({ removeView: true }, { children: true, texture: true, textureSource: true });
    },
  };
}
