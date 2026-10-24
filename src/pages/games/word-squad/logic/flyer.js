// src/pages/games/word-squad/logic/flyer.js
// The flying bomber bosses that come before each chapter's boss: a mini one
// about a third of the way in, a big one about two thirds in. The bomber
// hovers ahead, sways, and drops candy bombs. Each bomb is aimed where the
// squad will be when it lands, and its landing spot glows on the road while it
// falls — step aside to dodge. Shoot the bomber down for friends and coins;
// if it isn't beaten in time it flies away.
import { FLYERS, CHAPTER_HP, ROAD_HALF, SPEED, MAX_SQUAD } from './config.js';
import { dodgeReach } from './squad.js';
import { applyReward, effectiveReward } from './rewards.js';

export function createFlyers({ w, rng, emit, newId, loseSoldiers, spawnBug, chapter }) {
  w.flyer = null;
  w.bombs = [];
  const hpScale = CHAPTER_HP[chapter] ?? CHAPTER_HP[CHAPTER_HP.length - 1];

  function spawn(level) {
    if (w.flyer) return;
    const cfg = FLYERS[level];
    const hp = Math.round(cfg.hp * hpScale);
    w.flyer = {
      level, name: cfg.name, hp, maxHp: hp, x: 0, z: w.dist + 14, state: 'enter',
      bombT: 1.6, time: 0, flashT: 0, dyingT: 0, helped: false,
    };
    emit({ type: 'flyerSpawn', level, name: cfg.name });
  }

  function dropBombs(f) {
    const cfg = FLYERS[f.level];
    const speed = SPEED * (w.speedMul || 1);
    const spots = [w.squad.x];
    while (spots.length < cfg.bombs) spots.push((rng.next() - 0.5) * 2 * (ROAD_HALF - 0.3));
    for (const sx of spots) {
      w.bombs.push({
        id: newId(), level: f.level, fromX: f.x, fromZ: f.z,
        x: Math.max(-ROAD_HALF + 0.25, Math.min(ROAD_HALF - 0.25, sx + (rng.next() - 0.5) * 0.15)),
        // lands where the squad will be when the bomb comes down
        z: w.dist + speed * FLYERS.bombFall + 0.15 + rng.next() * 0.35,
        t: 0, fall: FLYERS.bombFall, r: FLYERS.bombRadius,
      });
    }
    emit({ type: 'bombDrop', count: spots.length });
  }

  function land(b) {
    b.dead = true;
    const near = Math.abs(w.squad.x - b.x) < b.r + dodgeReach(w.squad.count) && Math.abs(b.z - w.dist) < 0.6;
    emit({ type: 'bombLand', x: b.x, z: b.z, hit: near, big: b.level === 'big' });
    if (near) loseSoldiers(FLYERS[b.level].hitSoldiers, 'bomb');
    else emit({ type: 'dodge', kind: 'bomb' });
  }

  function defeat(f) {
    f.state = 'dying';
    f.dyingT = 1.2;
    const cfg = FLYERS[f.level];
    const before = w.squad.weapon;
    w.squad = { ...w.squad, ...applyReward(w.squad, cfg.reward) };
    w.squad.count = Math.min(MAX_SQUAD, w.squad.count);
    w.stats.coins += cfg.coins;
    w.stats.flyersBeaten += 1;
    emit({ type: 'flyerDefeated', level: f.level, x: f.x, z: f.z, reward: effectiveReward(cfg.reward, before), coins: cfg.coins });
  }

  /** Bullet / beam / splash damage (the world calls this when a hit lands on the bomber) */
  function hurt(amount) {
    const f = w.flyer;
    if (!f || f.state !== 'fight') return;
    f.hp -= amount;
    f.flashT = 0.06;
    if (f.hp <= 0) { f.hp = 0; defeat(f); }
  }

  function update(dt) {
    for (const b of w.bombs) { b.t += dt; if (b.t >= b.fall) land(b); }
    w.bombs = w.bombs.filter((b) => !b.dead);

    const f = w.flyer;
    if (!f) return;
    f.flashT = Math.max(0, f.flashT - dt);
    const hold = w.dist + FLYERS.holdZ;
    if (f.state === 'enter') {
      f.z = Math.max(hold, f.z - 2.2 * dt);
      if (f.z <= hold + 1e-6) { f.state = 'fight'; emit({ type: 'flyerReady', level: f.level }); }
      return;
    }
    if (f.state === 'fight') {
      f.time += dt;
      f.z = hold;
      // sway across the road, a bit faster for the big one
      const sp = f.level === 'big' ? 0.75 : 0.6;
      f.x = Math.sin(f.time * sp) * 0.85;
      f.bombT -= dt;
      if (f.bombT <= 0) { f.bombT = FLYERS[f.level].bombEvery; dropBombs(f); }
      const cfg = FLYERS[f.level];
      if (cfg.helpers && !f.helped && f.hp < f.maxHp * 0.5) {
        f.helped = true;
        for (let i = 0; i < cfg.helpers; i++) spawnBug('bee', f.x + (rng.next() - 0.5) * 1.2, FLYERS.holdZ - 0.5 - rng.next() * 0.6, true);
        emit({ type: 'flyerHelpers' });
      }
      if (f.time > FLYERS.leaveAfter) { f.state = 'leave'; emit({ type: 'flyerEscape', level: f.level }); }
      return;
    }
    if (f.state === 'leave') {
      f.z += (SPEED * (w.speedMul || 1) + 3) * dt; // flies off ahead, faster than the squad
      if (f.z - w.dist > 16) w.flyer = null;
      return;
    }
    if (f.state === 'dying') {
      f.z = hold;
      f.dyingT -= dt;
      if (f.dyingT <= 0) w.flyer = null;
    }
  }

  return { spawn, update, hurt };
}
