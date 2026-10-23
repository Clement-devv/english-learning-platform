// src/pages/games/word-squad/render/particles.js
// One pooled particle system for every effect (candy bursts, glow rings, smoke,
// sparks, fireworks, stars). Sprites are created once and reused; the cap
// follows the device and the adaptive quality level.
import { Container, Sprite } from 'pixi.js';

export function createParticles(atlas, cap) {
  const layer = new Container();
  const pool = [];
  const live = [];
  let limit = cap;

  function take() {
    if (live.length >= limit) return null;
    let s = pool.pop();
    if (!s) {
      s = new Sprite();
      s.anchor.set(0.5);
      layer.addChild(s); // stays a child for good; dead ones are just hidden
    }
    s.visible = true;
    live.push(s);
    return s;
  }

  /**
   * emit(name, x, y, opts) — opts: vx, vy, gravity, life, spin, scale, scaleTo,
   * alpha, alphaTo, tint, blend ('add'), rotation, drag, target ({x, y, onArrive})
   */
  function emit(name, x, y, o = {}) {
    const s = take();
    if (!s) return null;
    const art = atlas.get(name);
    s.texture = art.texture;
    s.position.set(x, y);
    s.rotation = o.rotation ?? 0;
    s.tint = o.tint ?? 0xffffff;
    s.blendMode = o.blend === 'add' ? 'add' : 'normal';
    s.alpha = o.alpha ?? 1;
    const p = {
      vx: o.vx || 0, vy: o.vy || 0, g: o.gravity || 0, life: o.life || 0.6, age: 0,
      spin: o.spin || 0, s0: (o.scale ?? 1) * art.inv, s1: (o.scaleTo ?? o.scale ?? 1) * art.inv,
      a0: o.alpha ?? 1, a1: o.alphaTo ?? 0, drag: o.drag ?? 0, target: o.target || null,
      ox: x, oy: y,
    };
    s.scale.set(p.s0);
    s._p = p;
    return s;
  }

  function update(dt) {
    let j = 0;
    for (let i = 0; i < live.length; i++) {
      const s = live[i];
      const p = s._p;
      p.age += dt;
      const t = Math.min(1, p.age / p.life);
      if (p.target) {
        // Fly along a curve into a target point (stars into the HUD counter)
        const e = t * t * (3 - 2 * t);
        const mx = (p.ox + p.target.x) / 2 + p.vx * 0.25, my = Math.min(p.oy, p.target.y) - 120 + p.vy * 0.1;
        s.x = (1 - e) * (1 - e) * p.ox + 2 * (1 - e) * e * mx + e * e * p.target.x;
        s.y = (1 - e) * (1 - e) * p.oy + 2 * (1 - e) * e * my + e * e * p.target.y;
      } else {
        p.vy += p.g * dt;
        if (p.drag) { const k = Math.max(0, 1 - p.drag * dt); p.vx *= k; p.vy *= k; }
        s.x += p.vx * dt;
        s.y += p.vy * dt;
      }
      s.rotation += p.spin * dt;
      const sc = p.s0 + (p.s1 - p.s0) * t;
      s.scale.set(sc);
      s.alpha = p.a0 + (p.a1 - p.a0) * (p.target ? t * t * t : t);
      if (t >= 1) {
        if (p.target?.onArrive) p.target.onArrive();
        s.visible = false;
        pool.push(s);
      } else {
        live[j++] = s;
      }
    }
    live.length = j;
  }

  return {
    layer,
    emit,
    update,
    setLimit: (n) => { limit = n; },
    get count() { return live.length; },
    get limit() { return limit; },
    clear() { for (const s of live) { s.visible = false; pool.push(s); } live.length = 0; },
  };
}
