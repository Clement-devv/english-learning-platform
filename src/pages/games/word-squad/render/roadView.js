// src/pages/games/word-squad/render/roadView.js
// Draws the Batch 1 things: spinners, gumdrop walls, coin trails, friend and
// power-up bubbles, letter bubbles, the boss's projectiles (darts, drum
// shockwave, goo, gumballs, stomp dust), the weak-spot target and the squad's
// shield bubble.
import { BitmapText, Container, Graphics, Sprite } from 'pixi.js';
import { ROAD_HALF } from '../logic/config.js';
import { laneCenter, squadRadius } from '../logic/squad.js';
import { PX_PER_UNIT } from '../logic/projection.js';

const ICON = { friends: 'iconFriends', shield: 'iconShield', frenzy: 'iconFrenzy' };

export function createRoadView(ctx) {
  const { world, labels, particles, keyed, sprite, shadowOf, releaseShadow, fade, proj } = ctx;

  // ── Obstacles ──────────────────────────────────────────────────────────────
  const obstacles = keyed(
    (o) => {
      const c = new Container();
      const parts = [];
      if (o.kind === 'spinner') parts.push(sprite('spinner', 0.5, 0.5));
      else {
        // gumdrop blocks across the road, leaving the gap
        for (let x = -ROAD_HALF + 0.14; x < ROAD_HALF; x += 0.28) {
          if (x > o.gx0 - 0.1 && x < o.gx1 + 0.1) continue;
          const s = sprite('gumBlock', 0.5, 1);
          s.tint = [0xffd1ea, 0xfff3b0, 0xc7f9ff, 0xe9d5ff][parts.length % 4];
          s._bx = x;
          parts.push(s);
        }
      }
      c.addChild(...parts);
      world.addChild(c);
      return { c, parts, shadow: o.kind === 'spinner' ? shadowOf() : null };
    },
    (v) => { v.c.destroy({ children: true }); if (v.shadow) releaseShadow(v.shadow); },
  );

  // ── Pickups and letters ────────────────────────────────────────────────────
  const pickups = keyed(
    (p) => {
      const c = new Container();
      if (p.kind === 'coin') c.addChild(sprite('coin', 0.5, 0.5));
      else {
        const bubble = sprite('pickBubble', 0.5, 0.5);
        const icon = sprite(ICON[p.kind], 0.5, 0.5);
        c.addChild(icon, bubble);
      }
      world.addChild(c);
      return { c, shadow: shadowOf() };
    },
    (v) => { v.c.destroy({ children: true }); releaseShadow(v.shadow); },
  );
  const letters = keyed(
    (ch) => {
      const c = new Container();
      const bubble = sprite('pickBubble', 0.5, 0.5);
      const t = new BitmapText({ text: ch, style: { fontFamily: 'WSComic', fontSize: 40 } });
      t.anchor.set(0.5);
      c.addChild(t, bubble);
      world.addChild(c);
      return { c, t, bubble, shadow: shadowOf() };
    },
    (v) => { v.c.destroy({ children: true }); releaseShadow(v.shadow); },
  );

  // ── Boss projectiles ───────────────────────────────────────────────────────
  const shots = keyed(
    (tg) => {
      const c = new Container();
      const list = [];
      const add = (name, ax = 0.5, ay = 0.5) => { const s = sprite(name, ax, ay); c.addChild(s); list.push(s); return s; };
      if (tg.kind === 'sting') for (let i = 0; i < 3; i++) { const s = add('rocket'); s.tint = 0xffd166; }
      else if (tg.kind === 'drum') { const s = add('ring'); s.tint = 0xff79c6; s.blendMode = 'add'; }
      else if (tg.kind === 'goo') for (let i = 0; i < 4; i++) add('goo');
      else if (tg.kind === 'gumball') add('gumball');
      world.addChild(c);
      return { c, list, smokeT: 0 };
    },
    (v) => v.c.destroy({ children: true }),
  );

  // ── Goo spat by shooting bugs ──────────────────────────────────────────────
  const goo = keyed(
    () => {
      const c = new Container();
      const glow = sprite('glow', 0.5, 0.5);
      glow.tint = 0xa3e635;
      glow.blendMode = 'add';
      const ball = sprite('goo', 0.5, 0.5);
      ball.tint = 0xbef264;
      c.addChild(glow, ball);
      world.addChild(c);
      return { c, glow, ball, shadow: shadowOf() };
    },
    (v) => { v.c.destroy({ children: true }); releaseShadow(v.shadow); },
  );

  // ── Weak spot, squad shield ────────────────────────────────────────────────
  const weak = sprite('target', 0.5, 0.5);
  weak.visible = false;
  weak.blendMode = 'normal';
  labels.addChild(weak);
  const shieldG = new Graphics();
  world.addChild(shieldG);

  function draw(w, t, dt, view) {
    const dist = w.dist;
    for (const o of w.obstacles) {
      const v = obstacles.get(o.id, o);
      const rz = o.z - dist;
      if (o.kind === 'spinner') {
        const q = proj(o.x, rz);
        const s = v.parts[0];
        s.position.set(q.x, q.y - 38 * q.s);
        s.rotation = t * 6;
        s.scale.set(q.s * s._inv * 1.15);
        s.alpha = fade(rz);
        v.c.zIndex = Math.round(-rz * 100);
        v.shadow.position.set(q.x, q.y);
        v.shadow.scale.set(q.s * v.shadow._inv * 0.9, q.s * v.shadow._inv * 0.7);
        v.shadow.alpha = fade(rz) * 0.7;
      } else {
        for (const s of v.parts) {
          const q = proj(s._bx, rz);
          s.position.set(q.x, q.y);
          s.scale.set(q.s * s._inv * 1.05);
          s.alpha = fade(rz);
        }
        v.c.zIndex = Math.round(-rz * 100) - 2;
      }
    }
    obstacles.sweep();

    for (const p of w.pickups) {
      const v = pickups.get(p.id, p);
      const rz = p.z - dist;
      const q = proj(p.x, rz);
      const bob = Math.sin(t * 4 + p.id) * 6 * q.s;
      v.c.position.set(q.x, q.y - 40 * q.s + bob);
      for (const s of v.c.children) s.scale.set(q.s * s._inv * (p.kind === 'coin' ? 1 : 1.25));
      if (p.kind === 'coin') v.c.children[0].scale.x *= Math.cos(t * 5 + p.id); // spinning coin
      v.c.alpha = fade(rz);
      v.c.zIndex = Math.round(-rz * 100) + 1;
      v.shadow.position.set(q.x, q.y);
      v.shadow.scale.set(q.s * v.shadow._inv * 0.5, q.s * v.shadow._inv * 0.4);
      v.shadow.alpha = fade(rz) * 0.5;
    }
    pickups.sweep();

    const next = w.spell && !w.spell.over ? w.letters.find((l) => !l.done) : null;
    for (const l of w.letters) {
      if (l.done) continue;
      const rz = l.z - dist;
      for (const [lane, ch, key] of [[l.lane, l.letter, `${l.id}a`], [l.decoyLane, l.decoy, `${l.id}b`]]) {
        const v = letters.get(key, ch);
        const q = proj(laneCenter(lane, 3), rz);
        const bob = Math.sin(t * 3 + lane) * 5 * q.s;
        v.c.position.set(q.x, q.y - 58 * q.s + bob);
        v.bubble.scale.set(q.s * v.bubble._inv * 1.9);
        v.t.scale.set(q.s * 1.5);
        v.t.tint = l === next ? 0xffffff : 0xffe066;
        v.c.alpha = fade(rz);
        v.c.zIndex = Math.round(-rz * 100) + 1;
        v.shadow.position.set(q.x, q.y);
        v.shadow.scale.set(q.s * v.shadow._inv * 0.55, q.s * v.shadow._inv * 0.45);
        v.shadow.alpha = fade(rz) * 0.5;
      }
    }
    letters.sweep();

    // Boss projectiles (only once they have been launched)
    const b = w.boss;
    for (const tg of w.telegraphs) {
      if (tg.state !== 'flying') continue;
      const v = shots.get(tg.id, tg);
      if (tg.shape === 'circle') {
        // gumball arcing from the boss to its landing spot
        const k = Math.min(1, tg.ft / tg.flight);
        const x = tg.fromX + (tg.cx - tg.fromX) * k;
        const rz = tg.fromRz + (tg.rz - tg.fromRz) * k;
        const q = proj(x, rz);
        const height = Math.sin(k * Math.PI) * 260 + (1 - k) * 120;
        const s = v.list[0];
        s.position.set(q.x, q.y - height * Math.max(0.35, q.s) - 20 * q.s);
        s.scale.set(q.s * s._inv * 1.6);
        s.rotation = t * 5;
        v.c.zIndex = Math.round(-rz * 100) + 5;
      } else if (tg.shape === 'lane') {
        const rz = tg.prz;
        const n = v.list.length;
        v.list.forEach((s, i) => {
          const x = n > 1 ? tg.x0 + ((i + 0.5) / n) * (tg.x1 - tg.x0) : (tg.x0 + tg.x1) / 2;
          const q = proj(x, rz);
          if (tg.kind === 'drum') {
            const width = (tg.x1 - tg.x0) * PX_PER_UNIT * q.s;
            s.position.set(q.x, q.y - 6 * q.s);
            s.scale.set((width / 96) * 1.2, (width / 96) * 0.4);
          } else {
            s.position.set(q.x, q.y - (tg.kind === 'sting' ? 40 : 18) * q.s + Math.sin(t * 12 + i) * 4 * q.s);
            s.scale.set(q.s * s._inv * (tg.kind === 'goo' ? 1.9 : 2.4));
            s.rotation = tg.kind === 'sting' ? Math.PI : Math.sin(t * 8 + i) * 0.3;
          }
        });
        v.c.zIndex = Math.round(-rz * 100) + 5;
      } else if (tg.shape === 'wave') {
        // stomp: a rolling wall of dust with one gap
        v.smokeT -= dt;
        if (v.smokeT <= 0) {
          v.smokeT = 0.04;
          for (let x = -ROAD_HALF + 0.15; x < ROAD_HALF; x += 0.35) {
            if (x > tg.gx0 && x < tg.gx1) continue;
            const q = proj(x + (Math.random() - 0.5) * 0.1, tg.prz);
            particles.emit('smoke', q.x, q.y - 10 * q.s, { scale: q.s * 0.7, scaleTo: q.s * 1.4, life: 0.35, alpha: 0.85, tint: 0xffe8c2, vy: -30 * q.s });
          }
        }
      }
    }
    shots.sweep();

    for (const p of w.shots || []) {
      const v = goo.get(p.id);
      const rz = p.z - dist;
      const q = proj(p.x, rz);
      const k = p.big ? 1.5 : 1;
      v.c.position.set(q.x, q.y - 34 * q.s);
      v.ball.scale.set(q.s * v.ball._inv * 1.7 * k);
      v.ball.rotation = t * 6;
      v.glow.scale.set(q.s * v.glow._inv * 2.2 * k * (1 + Math.sin(t * 20) * 0.1));
      v.c.zIndex = Math.round(-rz * 100) + 6;
      v.c.alpha = fade(rz);
      v.shadow.position.set(q.x, q.y);
      v.shadow.scale.set(q.s * v.shadow._inv * 0.5 * k, q.s * v.shadow._inv * 0.35 * k);
      v.shadow.alpha = 0.6;
    }
    goo.sweep();

    // Weak spot target on the boss
    if (b && b.weak && b.state === 'fight' && view.bossScreen) {
      const rz = b.z - dist;
      const q = proj(b.weak.x, rz);
      const bs = view.bossScreen;
      weak.visible = true;
      weak.position.set(q.x, bs.y + bs.top * bs.s * 0.45);
      const pulse = 1 + Math.sin(t * 12) * 0.12;
      weak.scale.set(weak._inv * Math.max(0.55, bs.s * 0.9) * pulse);
      weak.alpha = Math.min(1, b.weak.t * 3);
      weak.rotation = t * 1.5;
    } else weak.visible = false;

    // Squad shield bubble / frenzy glow
    shieldG.clear();
    const sq = w.squad;
    if (sq.count > 0 && (sq.shieldT > 0 || sq.frenzyT > 0)) {
      const q = proj(sq.x, 0.05);
      const r = squadRadius(sq.count) * PX_PER_UNIT * q.s + 26;
      const blink = sq.shieldT > 0 && sq.shieldT < 1.5 ? (Math.sin(t * 20) > 0 ? 1 : 0.3) : 1;
      if (sq.shieldT > 0) {
        shieldG.ellipse(q.x, q.y - 40, r, r * 0.9 + 20).fill({ color: 0x7dd3fc, alpha: 0.18 * blink }).stroke({ width: 4, color: 0xe0f7ff, alpha: 0.9 * blink });
      }
      if (sq.frenzyT > 0) {
        shieldG.ellipse(q.x, q.y, r * 1.05, r * 0.32).stroke({ width: 5, color: 0xffb703, alpha: 0.5 + 0.4 * Math.sin(t * 16) });
      }
      shieldG.zIndex = 10;
    }
  }

  function destroy() { obstacles.clear(); pickups.clear(); letters.clear(); shots.clear(); goo.clear(); weak.destroy(); shieldG.destroy(); }
  return { draw, destroy };
}
