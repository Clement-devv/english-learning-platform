// src/pages/games/word-squad/render/flyerView.js
// Draws the flying bombers: the bug itself (flapping wings, a helmet on the big
// one) hovering above its shadow, its health bar and name, the candy bombs
// falling, and the glowing spot on the road where each bomb will land.
import { BitmapText, Container, Graphics, Sprite } from 'pixi.js';
import { FLYERS } from '../logic/config.js';
import { PX_PER_UNIT } from '../logic/projection.js';

const HOVER = 230;   // px above the road at scale 1
const BASE = 1.35;   // bomber size at scale 1

function part(atlas, name, x, y, ax, ay, flip = false) {
  const art = atlas.get(name);
  const s = new Sprite(art.texture);
  s.anchor.set(ax, ay);
  s.scale.set(art.inv * (flip ? -1 : 1), art.inv);
  s.position.set(x, y);
  return s;
}

export function createFlyerView({ atlas, world, labels, ground, proj, sprite, shadowOf, releaseShadow }) {
  const marks = new Graphics();      // landing spots, on the road under everything
  ground.addChild(marks);

  let view = null;                   // the current bomber
  const bombs = new Map();           // bomb id → sprite

  function build(f) {
    const root = new Container();
    const rig = new Container();
    const wingL = part(atlas, 'bomberWing', -40, -120, 0.95, 0.75);
    const wingR = part(atlas, 'bomberWing', 40, -120, 0.95, 0.75, true);
    const body = part(atlas, 'bomberBody', 0, 0, 0.5, 1);
    rig.addChild(wingL, wingR, body);
    if (f.level === 'big') rig.addChild(part(atlas, 'bomberHelmet', 0, -150, 0.5, 1));
    root.addChild(rig);
    world.addChild(root);

    const hud = new Container();
    const bar = new Graphics();
    const hp = new BitmapText({ text: '', style: { fontFamily: 'WSNum', fontSize: 28 } });
    hp.anchor.set(0.5, 1);
    hp.y = -14;
    const name = new BitmapText({ text: f.name.toUpperCase(), style: { fontFamily: 'WSComic', fontSize: 22 } });
    name.anchor.set(0.5, 1);
    name.y = -46;
    name.tint = f.level === 'big' ? 0xff8fab : 0xbef264;
    hud.addChild(bar, hp, name);
    labels.addChild(hud);
    return { id: f, root, rig, wingL, wingR, body, hud, bar, hp, shown: -1, shadow: shadowOf() };
  }
  function drop() {
    if (!view) return;
    view.root.destroy({ children: true });
    view.hud.destroy({ children: true });
    releaseShadow(view.shadow);
    view = null;
  }

  function draw(w, t) {
    const f = w.flyer;
    if (!f) drop();
    else {
      if (!view || view.id !== f) { drop(); view = build(f); }
      const rz = f.z - w.dist;
      const q = proj(f.x, rz);
      const k = q.s * BASE * FLYERS[f.level].scale;
      const bob = Math.sin(t * 3) * 10 * q.s;
      view.root.position.set(q.x, q.y - HOVER * q.s + bob);
      view.root.scale.set(k);
      view.root.zIndex = Math.round(-rz * 100) + 20;
      view.root.alpha = f.state === 'dying' ? Math.max(0, f.dyingT / 1.2) : 1;
      view.rig.rotation = f.state === 'dying' ? Math.sin(t * 30) * 0.3 : Math.sin(t * 1.4) * 0.08;
      const flap = Math.sin(t * 40) * 0.35;
      view.wingL.rotation = -0.2 + flap;
      view.wingR.rotation = 0.2 - flap;
      const hit = f.flashT > 0;
      for (const p of view.rig.children) p.tint = hit ? 0xffc4c4 : 0xffffff;
      view.shadow.position.set(q.x, q.y);
      view.shadow.scale.set(k * view.shadow._inv * 1.6, k * view.shadow._inv * 1.0);
      view.shadow.alpha = 0.45;

      const hpNow = Math.ceil(f.hp);
      if (hpNow !== view.shown) {
        view.shown = hpNow;
        view.hp.text = String(hpNow);
        const frac = Math.max(0, f.hp / f.maxHp);
        view.bar.clear();
        view.bar.roundRect(-100, -10, 200, 18, 9).fill(0x2a1f45);
        if (frac > 0) view.bar.roundRect(-97, -7, Math.max(12, 194 * frac), 12, 6).fill(frac > 0.5 ? 0x22c55e : frac > 0.25 ? 0xffb703 : 0xef4444);
      }
      view.hud.visible = f.state === 'fight' || f.state === 'enter';
      view.hud.position.set(q.x, q.y - HOVER * q.s - 210 * k + bob);
    }

    // Bombs falling from the bomber to their landing spots
    marks.clear();
    const seen = new Set();
    for (const b of w.bombs) {
      seen.add(b.id);
      let s = bombs.get(b.id);
      if (!s) { s = sprite('bomb', 0.5, 0.5); world.addChild(s); bombs.set(b.id, s); }
      const k = Math.min(1, b.t / b.fall);
      const rzLand = b.z - w.dist;
      const rzFrom = b.fromZ - w.dist;
      const x = b.fromX + (b.x - b.fromX) * k;
      const rz = rzFrom + (rzLand - rzFrom) * k;
      const q = proj(x, rz);
      const height = (1 - k * k) * HOVER;
      s.position.set(q.x, q.y - height * q.s - 20 * q.s);
      s.scale.set(q.s * s._inv * 1.5);
      s.rotation = t * 4;
      s.zIndex = Math.round(-rz * 100) + 19;
      // glowing target ring that tightens as the bomb comes down
      const g = proj(b.x, rzLand);
      const rx = b.r * PX_PER_UNIT * g.s;
      const pulse = 0.5 + 0.5 * Math.sin(t * (12 + k * 20));
      marks.ellipse(g.x, g.y, rx, rx * 0.36).fill({ color: 0xff3b5c, alpha: 0.25 + 0.3 * pulse });
      marks.ellipse(g.x, g.y, rx * (1.4 - k * 0.4), rx * 0.36 * (1.4 - k * 0.4)).stroke({ width: 4, color: 0xffffff, alpha: 0.9 });
    }
    for (const [id, s] of bombs) if (!seen.has(id)) { s.destroy(); bombs.delete(id); }
  }

  return {
    draw,
    /** Where the bomber is on screen (for effects) */
    screen() { return view ? { x: view.root.x, y: view.root.y - 90 * view.root.scale.y, s: view.root.scale.x } : null; },
    destroy() { drop(); for (const s of bombs.values()) s.destroy(); bombs.clear(); marks.destroy(); },
  };
}
