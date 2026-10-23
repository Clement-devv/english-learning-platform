// src/pages/games/word-squad/render/fx.js
// Turns world events into effects and sounds: candy bug pops with glow rings,
// the 60 ms white hit flash, comic text, combos, rocket blasts, boss attack
// sweeps, and the boss-defeat show (slow motion, staged explosions, fireworks,
// star shower into the HUD counter, zoom-punch, shake, vibration).
import { BitmapText, Sprite } from 'pixi.js';
import { sfx } from '../audio/sfx.js';
import { formation } from '../logic/squad.js';
import { rewardLabel } from '../logic/rewards.js';
import { MAX_SHOOTERS } from '../logic/config.js';

const BUG_H = 30; // centre of a bug above its feet, px at scale 1

export function createFx(R, { reducedMotion, onStars }) {
  const P = R.particles;
  const candy = R.candy;
  let quality = 0;
  let pf = reducedMotion ? 0.5 : 1;          // particle factor

  // ── HUD (not shaken) ───────────────────────────────────────────────────────
  const starArt = R.atlas.get('starGold');
  const starIcon = new Sprite(starArt.texture);
  starIcon.anchor.set(0.5);
  starIcon.scale.set(starArt.inv * 1.3);
  const starText = new BitmapText({ text: '0', style: { fontFamily: 'WSNum', fontSize: 36 } });
  starText.anchor.set(0, 0.5);
  const comboText = new BitmapText({ text: '', style: { fontFamily: 'WSComic', fontSize: 46 } });
  comboText.anchor.set(0.5);
  const banner = new BitmapText({ text: '', style: { fontFamily: 'WSComic', fontSize: 64 } });
  banner.anchor.set(0.5);
  banner.visible = false;
  const coinArt = R.atlas.get('coin');
  const coinIcon = new Sprite(coinArt.texture);
  coinIcon.anchor.set(0.5);
  coinIcon.scale.set(coinArt.inv * 1.1);
  const coinText = new BitmapText({ text: '0', style: { fontFamily: 'WSNum', fontSize: 30 } });
  coinText.anchor.set(0, 0.5);
  R.hud.addChild(starIcon, starText, coinIcon, coinText, comboText, banner);
  let coins = 0;
  let coinPop = 0;
  let stars = 0;
  let starPop = 0;
  let comboT = 0;
  let bannerT = 0;
  const starTarget = () => ({ x: R.W - 96, y: R.top + 205 }); // below the question strip, even when it wraps
  function layoutHud() {
    const t = starTarget();
    starIcon.position.set(t.x, t.y);
    starIcon.scale.set(starArt.inv * 1.3 * (1 + starPop * 0.35));
    starText.position.set(t.x + 26, t.y + 2);
    coinIcon.position.set(t.x, t.y + 46);
    coinIcon.scale.set(coinArt.inv * 1.1 * (1 + coinPop * 0.4));
    coinText.position.set(t.x + 26, t.y + 48);
    comboText.anchor.set(0, 0.5);
    comboText.position.set(24, R.top + 205);
    banner.position.set(R.W / 2, R.top + 300);
  }
  function addStars(n) {
    stars += n;
    starText.text = String(stars);
    starPop = 1;
    sfx.star();
    onStars?.(stars);
  }

  // ── Comic text in the world ────────────────────────────────────────────────
  const texts = [];
  const textPool = [];
  function say(str, x, y, { size = 1, color = 0xffffff, life = 0.9, rise = 60 } = {}) {
    if (texts.length > 14) return;
    const t = textPool.pop() || new BitmapText({ text: '', style: { fontFamily: 'WSComic', fontSize: 52 } });
    t.text = str;
    t.anchor.set(0.5);
    t.tint = color;
    t.position.set(x, y);
    t.visible = true;
    R.labels.addChild(t);
    texts.push({ t, age: 0, life, size, rise, y });
  }
  function showBanner(str, secs = 1.6, color = 0xffffff) {
    banner.text = str;
    banner.tint = color;
    banner.visible = true;
    bannerT = secs;
  }

  // ── Camera shake / zoom / slow motion ──────────────────────────────────────
  let shake = 0;
  let zoom = 0;
  let slowT = 0;
  const kick = (a) => { if (!reducedMotion) shake = Math.max(shake, a); };

  // ── Timed effects (boss defeat) and attack sweeps ──────────────────────────
  const timers = [];
  const after = (sec, fn) => timers.push({ at: sec, fn });
  const sweeps = [];
  const view = { sweeps, hurtT: 0, bubblePop: 0, quality: 0, bossScreen: null };

  // ── Building blocks ────────────────────────────────────────────────────────
  const at = (x, z, w, lift = BUG_H) => { const q = R.proj(x, z - w.dist); return { x: q.x, y: q.y - lift * q.s, s: q.s }; };
  const rnd = (a, b) => a + Math.random() * (b - a);
  const pick = (l) => l[Math.floor(Math.random() * l.length)];

  function burst(x, y, s, { n = 10, colors = candy, speed = 1, big = false } = {}) {
    const count = Math.round(n * pf * (quality ? 0.6 : 1));
    for (let i = 0; i < count; i++) {
      const a = rnd(0, Math.PI * 2);
      const v = rnd(110, 260) * speed * s * (big ? 1.6 : 1);
      P.emit(pick(['gumdrop', 'gumdrop', 'sprinkle', 'starSmall']), x, y, {
        vx: Math.cos(a) * v, vy: Math.sin(a) * v - rnd(120, 260) * s, gravity: 900 * s,
        spin: rnd(-12, 12), life: rnd(0.6, 1.0), scale: rnd(0.8, 1.3) * s * (big ? 1.5 : 1),
        alpha: 1, alphaTo: 0.2, tint: pick(colors), rotation: rnd(0, 6),
      });
    }
    if (quality < 1) {
      P.emit('ring', x, y, { scale: 0.25 * s, scaleTo: (big ? 2.2 : 1.1) * s, life: 0.32, alpha: 0.9, tint: pick(colors), blend: 'add' });
      P.emit('glow', x, y, { scale: 0.6 * s, scaleTo: (big ? 2.4 : 1.3) * s, life: 0.22, alpha: 0.9, tint: 0xfff3c4, blend: 'add' });
    }
  }
  function flash(x, y, s, scale = 0.55) {
    P.emit('spark', x, y, { scale: scale * s, scaleTo: scale * 1.3 * s, life: 0.06, alpha: 1, alphaTo: 0.6, blend: 'add', rotation: rnd(0, 1) });
  }
  function blast(x, y, s, big = false) {
    P.emit('ring', x, y, { scale: 0.3 * s, scaleTo: (big ? 4 : 2.2) * s, life: big ? 0.5 : 0.35, alpha: 1, tint: 0xffd166, blend: 'add' });
    P.emit('glow', x, y, { scale: 1 * s, scaleTo: (big ? 4 : 2.4) * s, life: 0.3, alpha: 1, tint: 0xfff3c4, blend: 'add' });
    for (let i = 0; i < Math.round((big ? 8 : 5) * pf); i++) {
      P.emit('smoke', x + rnd(-20, 20) * s, y + rnd(-10, 10) * s, { vx: rnd(-60, 60) * s, vy: rnd(-90, -30) * s, scale: rnd(0.6, 1) * s * (big ? 2 : 1), scaleTo: rnd(1.4, 2) * s * (big ? 2 : 1), life: rnd(0.5, 0.8), alpha: 0.75, tint: 0xf3eefc, drag: 1.5 });
    }
    burst(x, y, s, { n: big ? 18 : 8, speed: big ? 1.4 : 1 });
  }
  function fireworks(n = 5) {
    for (let k = 0; k < n; k++) {
      after(k * 0.22, () => {
        const x = rnd(R.W * 0.15, R.W * 0.85), y = rnd(R.top + 120, 280);
        const col = pick(candy);
        const count = Math.round(26 * pf);
        for (let i = 0; i < count; i++) {
          const a = (i / count) * Math.PI * 2, v = rnd(160, 260);
          P.emit('starSmall', x, y, { vx: Math.cos(a) * v, vy: Math.sin(a) * v, gravity: 160, drag: 1.2, life: rnd(0.9, 1.3), scale: rnd(0.6, 1), alpha: 1, alphaTo: 0, tint: col, blend: 'add' });
        }
        P.emit('glow', x, y, { scale: 1.5, scaleTo: 3, life: 0.3, tint: col, blend: 'add' });
        sfx.boom(false);
      });
    }
  }
  function starShower(x, y, n, value) {
    const target = starTarget();
    const per = Math.max(1, Math.floor(value / n));
    let left = value;
    for (let i = 0; i < n; i++) {
      const give = i === n - 1 ? left : Math.min(per, left);
      left -= give;
      after(i * 0.05, () => {
        P.emit('starGold', x + rnd(-40, 40), y + rnd(-30, 30), {
          vx: rnd(-300, 300), vy: rnd(-200, 100), life: rnd(0.7, 1.0), scale: rnd(0.8, 1.2), scaleTo: 0.6, alpha: 1, alphaTo: 1, spin: rnd(-4, 4),
          target: { x: target.x, y: target.y, onArrive: () => give > 0 && addStars(give) },
        });
      });
    }
  }
  function muzzles(w) {
    if (quality > 0) return;
    const spots = formation(Math.min(w.squad.count, MAX_SHOOTERS));
    for (const p of spots) {
      const q = R.proj(w.squad.x + p.dx, p.dz + 0.05);
      P.emit('muzzle', q.x + 10 * q.s, q.y - 58 * q.s, { scale: 0.6 * q.s, scaleTo: 0.3 * q.s, life: 0.05, alpha: 1, blend: 'add', rotation: rnd(0, 3) });
    }
  }
  /** Soldiers knocked out of the squad tumble away and vanish in sparkles (kid-safe) */
  function fling(w, n) {
    const spots = formation(Math.min(w.squad.count + n, 40)).slice(-n);
    for (const p of spots) {
      const q = R.proj(w.squad.x + p.dx, p.dz);
      const dir = p.dx >= 0 ? 1 : -1;
      P.emit(`soldier_${w.squad.weapon}_0`, q.x, q.y - 30 * q.s, { vx: dir * rnd(160, 320), vy: -rnd(320, 520), gravity: 1100, spin: dir * rnd(6, 12), life: 0.75, scale: q.s * 0.95, scaleTo: q.s * 0.6, alpha: 1, alphaTo: 0 });
      after(0.55, () => P.emit('starSmall', q.x + dir * 150, q.y - 140, { scale: 0.8, scaleTo: 1.6, life: 0.3, alpha: 1, tint: 0xfff3b0, blend: 'add' }));
    }
  }
  function squadPos(w) { const q = R.proj(w.squad.x, 0.2); return { x: q.x, y: q.y - 120, s: q.s }; }

  // ── Events ─────────────────────────────────────────────────────────────────
  function handle(events, w) {
    for (const e of events) {
      switch (e.type) {
        case 'shoot': sfx.pew(e.weapon); muzzles(w); break;
        case 'hit': { const p = at(e.x, e.z, w); flash(p.x, p.y, p.s, e.beam ? 0.4 : 0.55); break; }
        case 'pop': {
          const p = at(e.x, e.z, w, e.big ? 70 : BUG_H);
          burst(p.x, p.y, p.s * (e.big ? 1.4 : 1), { n: e.big ? 22 : rnd(8, 14), big: e.big });
          if (e.big) { say(pick(['POP!', 'BOOM!', 'WOW!']), p.x, p.y - 40, { size: 1.3 * Math.max(0.6, p.s) }); sfx.boom(true); kick(10); }
          else sfx.pop();
          break;
        }
        case 'combo':
          if (e.count >= 5) {
            comboText.text = `×${e.count} COMBO!`;
            comboText.scale.set(1.35);
            comboT = 0.9;
            if (e.count % 10 === 0) { const p = squadPos(w); say('WOW!', p.x, p.y - 40, { size: 1.2 }); }
          }
          sfx.combo(e.count);
          break;
        case 'explode': {
          const p = at(e.x, e.z, w, 20);
          blast(p.x, p.y, p.s);
          if (Math.random() < 0.3) say('BOOM!', p.x, p.y - 30 * p.s, { size: Math.max(0.5, p.s) * 0.9, life: 0.6 });
          sfx.boom(false);
          kick(3);
          break;
        }
        case 'squadHit': {
          const p = squadPos(w);
          say(`-${e.amount}`, p.x + rnd(-30, 30), p.y + 20, { color: 0xff6b6b, size: 0.9, life: 0.7 });
          view.hurtT = 0.15;
          view.bubblePop = 1;
          sfx.hurt();
          kick(e.cause === 'boss' ? 14 : e.cause === 'obstacle' ? 9 : 5);
          if (e.cause === 'boss' || e.cause === 'obstacle' || e.cause === 'crate') fling(w, Math.min(6, e.amount));
          break;
        }
        case 'gateResult': {
          const p = squadPos(w);
          if (e.correct) {
            sfx.gateRight();
            const label = rewardLabel(e.reward, null).toUpperCase();
            say(`${label}!`, p.x, p.y - 30, { size: 1, color: 0xffffff, life: 1.3, rise: 90 });
            starShower(p.x, p.y, 6, 3);
            setTimeout(() => sfx.reward(), 180);
            view.bubblePop = 1;
          } else {
            sfx.gateWrong();
            say('OOPS!', p.x, p.y - 30, { size: 1.1, color: 0xff8fab, life: 1.1 });
            kick(9);
          }
          break;
        }
        case 'crateOpen': {
          const p = at(e.x, e.z, w, 30);
          burst(p.x, p.y, p.s, { n: 14, colors: [0xff6b6b, 0xc81d4a, 0xfff3c4] });
          blast(p.x, p.y, p.s * 0.8);
          say(`${rewardLabel(e.reward, null).toUpperCase()}!`, p.x, p.y - 40 * p.s, { size: Math.max(0.6, p.s), life: 1 });
          sfx.boom(false); sfx.reward();
          break;
        }
        case 'crateSmash': kick(8); break;
        case 'swarm': if (e.size >= 35 || e.angry) showBanner(e.angry ? 'ANGRY BUGS!' : 'HERE THEY COME!', 1.3, e.angry ? 0xff8fab : 0xffffff); break;
        case 'miniBoss': showBanner('MINI-BOSS!', 1.3, 0xff8fab); sfx.roar(); break;
        case 'bossSpawn': showBanner(`${e.name.toUpperCase()}!`, 2.2, 0xffd166); sfx.roar(); kick(8); break;
        case 'bossTelegraph': sfx.warn(); sfx.windup(); break;
        case 'bossLaunch': sfx.whoosh(); kick(4); break;
        case 'weakOpen': sfx.ping(); break;
        case 'weakHit': {
          const p = at(e.x, e.z, w, 0);
          const y = view.bossScreen ? view.bossScreen.y + view.bossScreen.top * view.bossScreen.s * 0.45 : p.y;
          flash(p.x, y, 1.2, 0.8);
          if (Math.random() < 0.35) say('SUPER HIT!', p.x, y - 40, { size: 0.8, color: 0xffe066, life: 0.6 });
          break;
        }
        case 'bossShield': showBanner('WORD SHIELD!', 1.6, 0x7dd3fc); sfx.powerup(); break;
        case 'shieldBreak': {
          const b = view.bossScreen;
          if (b) for (let i = 0; i < Math.round(26 * pf); i++) P.emit('sprinkle', b.x + rnd(-160, 160) * b.s, b.y + b.top * b.s * rnd(0.2, 0.9), { vx: rnd(-420, 420), vy: rnd(-420, 120), gravity: 900, spin: rnd(-14, 14), life: rnd(0.6, 1), scale: rnd(1.4, 2.4), alpha: 0.95, alphaTo: 0, tint: 0xc7f3ff });
          showBanner('SHIELD BROKEN!', 1.6, 0x7dd3fc); sfx.shatter(); sfx.boom(true); kick(14);
          break;
        }
        case 'shieldDown': sfx.shatter(); break;
        case 'bossEnrage': showBanner(e.phase >= 2 ? 'BOSS IS FURIOUS!' : 'BOSS IS ANGRY!', 1.6, 0xff8fab); sfx.roar(); kick(10); break;
        case 'bump': { const p = at(e.x, e.z, w, 30); say('BONK!', p.x, p.y - 30, { size: 0.9, color: 0xffb3c6, life: 0.7 }); sfx.bonk(); break; }
        case 'dodge': if (['drum', 'goo', 'sting', 'stomp', 'gumball', 'spit'].includes(e.kind) && Math.random() < (e.kind === 'spit' ? 0.4 : 1)) { const p = squadPos(w); say('DODGED!', p.x, p.y - 20, { size: 0.8, color: 0x9be7ff, life: 0.7 }); } break;
        case 'coin': { const p = at(e.x, e.z, w, 40); const t = starTarget(); P.emit('coin', p.x, p.y, { life: 0.55, scale: p.s, scaleTo: 0.8, alpha: 1, alphaTo: 1, target: { x: t.x, y: t.y + 46, onArrive: () => { coins += 1; coinText.text = String(coins); coinPop = 1; } } }); sfx.coin(); break; }
        case 'pickup': {
          const p = at(e.x, e.z, w, 40);
          burst(p.x, p.y, p.s, { n: 10, colors: [0xffffff, 0x9be7ff] });
          if (e.kind === 'friends') say(`+${e.amount}`, p.x, p.y - 20, { size: 1, color: 0xb8f7c8 });
          else showBanner(e.kind === 'shield' ? 'SHIELD!' : 'FRENZY!', 1.2, e.kind === 'shield' ? 0x7dd3fc : 0xffb703);
          sfx.powerup();
          view.bubblePop = 1;
          break;
        }
        case 'shielded': { const p = squadPos(w); flash(p.x, p.y + 60, 1, 0.9); sfx.ping(); break; }
        case 'spellStart': showBanner(`SPELL: ${e.word}`, 1.6, 0xffffff); break;
        case 'letter': { const p = at(e.x, e.z, w, 60); say(e.ok ? `${e.letter}!` : 'X', p.x, p.y, { size: 1, color: e.ok ? 0x86efac : 0xff8fab, life: 0.7 }); sfx.letter(e.ok); break; }
        case 'spellDone':
          if (e.ok) { showBanner(`YOU SPELLED ${e.word}!`, 1.8, 0x86efac); confetti(0.4); sfx.gateRight(); }
          else showBanner('ALMOST! NEXT TIME', 1.2, 0xffffff);
          break;
        case 'down': sfx.lose(); break;
        case 'speedUp': { const p = squadPos(w); say('FASTER!', p.x, p.y - 60, { size: 0.9, color: 0x9be7ff, life: 0.9, rise: 80 }); sfx.whoosh(); break; }
        case 'shootersArrive': showBanner('BUGS ARE SHOOTING! DODGE!', 2, 0xbef264); sfx.roar(); kick(8); break;
        case 'enemyShot': { const p = at(e.x, e.z, w, 40); P.emit('glow', p.x, p.y, { scale: 0.5 * p.s, scaleTo: 1.4 * p.s, life: 0.2, tint: 0xbef264, blend: 'add' }); sfx.spit(); break; }
        case 'spitHit': { const p = at(e.x, e.z, w, 30); burst(p.x, p.y, Math.max(0.7, p.s), { n: 12, colors: [0xbef264, 0xd9f99d, 0xffffff] }); say('SPLAT!', p.x, p.y - 30, { size: 0.8, color: 0xbef264, life: 0.6 }); break; }
        case 'revived': { const p = squadPos(w); burst(p.x, p.y + 60, 1, { n: 24, big: true }); showBanner('BACK IN THE FIGHT!', 1.6, 0x86efac); sfx.powerup(); break; }
        case 'bossStronger': showBanner('BOSS POWER UP!', 1.4, 0xff8fab); sfx.roar(); break;
        case 'bossAttack': {
          const color = { sting: 0xffd166, drum: 0xff79c6, goo: 0x34d399, stomp: 0xffb703 }[e.kind];
          // impact where the projectile reaches the squad's row
          if (e.shape === 'lane' && e.kind !== 'summon') { const q = R.proj((e.x0 + e.x1) / 2, 0.3); burst(q.x, q.y - 20, q.s * 0.8, { n: 10, colors: [color, 0xffffff] }); }
          if (e.shape === 'wave') { const q = R.proj(w.squad.x, 0.3); blast(q.x, q.y - 10, q.s * 0.6); }
          if (e.kind === 'gumball') { const q = R.proj(e.cx, e.rz); burst(q.x, q.y - 20, q.s, { n: 16, colors: [0xff4fa3, 0xffd1ea, 0xffd166] }); sfx.boom(false); kick(6); }
          if (e.kind === 'goo' && quality < 2) for (let i = 0; i < 10 * pf; i++) { const rz = rnd(0, 4); const q = R.proj(rnd(e.x0, e.x1), rz); P.emit('goo', q.x, q.y - 10 * q.s, { vy: -rnd(40, 120) * q.s, gravity: 200, life: 0.7, scale: rnd(0.7, 1.3) * q.s * 1.4, alpha: 0.95, alphaTo: 0 }); }
          if (e.kind === 'summon' && view.bossScreen) { const b = view.bossScreen; blast(b.x, b.y - 20, b.s * 0.35); }
          if (e.kind === 'drum' || e.kind === 'stomp') { kick(e.kind === 'stomp' ? 12 : 7); sfx.boom(e.kind === 'stomp'); }
          break;
        }
        case 'bossDefeated': bossFinale(w); break;
        case 'won': sfx.victory(); confetti(); break;
        case 'lost': sfx.lose(); break;
        default: break;
      }
    }
  }

  function confetti(amount = 1) {
    for (let i = 0; i < Math.round(80 * pf * amount); i++) {
      P.emit('confetti', rnd(0, R.W), R.top - 20, { vx: rnd(-60, 60), vy: rnd(120, 280), gravity: 60, spin: rnd(-8, 8), life: rnd(2, 3.2), scale: rnd(0.9, 1.5), alpha: 1, alphaTo: 0.8, tint: pick(candy), rotation: rnd(0, 6) });
    }
  }

  function bossFinale(w) {
    const b = view.bossScreen || { x: R.W / 2, y: 520, s: 1, top: -300 };
    if (!reducedMotion) { slowT = 0.8; zoom = 0.12; }
    kick(18);
    try { navigator.vibrate?.(80); } catch { /* not supported */ }
    sfx.boom(true);
    const spots = [[0, 0.5], [-0.3, 0.7], [0.3, 0.35], [-0.15, 0.2], [0.2, 0.8]];
    spots.forEach(([fx, fy], i) => after(0.12 + i * 0.22, () => {
      const x = b.x + fx * 300 * b.s, y = b.y + b.top * b.s * fy;
      blast(x, y, Math.max(0.6, b.s * 0.6), true);
      say(pick(['BOOM!', 'POW!', 'WOW!']), x, y - 30, { size: 1.2, life: 0.8 });
      sfx.boom(true);
      kick(12);
    }));
    fireworks(6);
    const eligible = w.stats.right * 2 >= w.stats.answered && w.stats.answered > 0;
    after(0.9, () => starShower(b.x, b.y + b.top * b.s * 0.5, 24, eligible ? 10 : 0));
    after(1.0, () => showBanner('BOSS BEATEN!', 2, 0xffd166));
  }

  // ── Per frame ──────────────────────────────────────────────────────────────
  let clock = 0;
  let streakT = 0;
  function update(dt, w) {
    clock += dt;
    for (let i = timers.length - 1; i >= 0; i--) {
      if (timers[i].at <= 0) { const f = timers[i].fn; timers.splice(i, 1); f(); } else timers[i].at -= dt;
    }
    let j = 0;
    for (const s of sweeps) { s.age += dt; if (s.age < s.life) sweeps[j++] = s; }
    sweeps.length = j;

    let k = 0;
    for (const x of texts) {
      x.age += dt;
      const t = x.age / x.life;
      if (t >= 1) { x.t.visible = false; R.labels.removeChild(x.t); textPool.push(x.t); continue; }
      const popIn = t < 0.15 ? 0.4 + (t / 0.15) * 0.8 : 1.2 - Math.min(0.2, (t - 0.15) * 0.6);
      x.t.scale.set(x.size * popIn);
      x.t.y = x.y - x.rise * t;
      x.t.alpha = t > 0.7 ? 1 - (t - 0.7) / 0.3 : 1;
      texts[k++] = x;
    }
    texts.length = k;

    comboT -= dt;
    comboText.visible = comboT > 0;
    if (comboT > 0) comboText.scale.set(Math.max(1, comboText.scale.x - dt * 2));
    bannerT -= dt;
    if (bannerT <= 0) banner.visible = false;
    else banner.scale.set(1 + Math.max(0, bannerT - 1.2) * 0.4 + Math.sin(clock * 8) * 0.02);
    starPop = Math.max(0, starPop - dt * 4);
    coinPop = Math.max(0, coinPop - dt * 5);
    view.hurtT = Math.max(0, view.hurtT - dt);
    view.bubblePop = Math.max(0, view.bubblePop - dt * 4);
    layoutHud();

    // camera
    shake = Math.max(0, shake - dt * 40);
    zoom = Math.max(0, zoom - dt * 0.25);
    const cam = R.cam;
    const px = R.W / 2, py = 700;
    cam.pivot.set(px, py);
    cam.scale.set(1 + zoom);
    cam.position.set(px + (Math.random() - 0.5) * shake, py + (Math.random() - 0.5) * shake);

    if (w.beam && w.squad.count > 0) sfx.laserHum();
    // speed streaks rushing past at the edges of the screen once the squad is fast
    streakT -= dt;
    if (w.speedMul > 1.12 && streakT <= 0 && quality < 2) {
      streakT = 0.12 / (w.speedMul - 1);
      const side = Math.random() < 0.5 ? -1 : 1;
      const x = R.W / 2 + side * (R.W * (0.36 + Math.random() * 0.14));
      const y = 520 + Math.random() * 260;
      P.emit('tracer', x, y, { vx: side * 120, vy: 900 * w.speedMul, life: 0.35, scale: 1.4, scaleTo: 2.2, alpha: 0.45, alphaTo: 0, rotation: -side * 0.15, blend: 'add' });
    }
    P.update(dt);
    view.quality = quality;
  }

  return {
    handle,
    update,
    view,
    /** Real-time scale for the simulation (slow motion after a boss) */
    timeScale(realDt) {
      if (slowT > 0) { slowT -= realDt; return 0.3; }
      return 1;
    },
    setQuality(level) { quality = level; pf = (reducedMotion ? 0.5 : 1) * (level === 0 ? 1 : level === 1 ? 0.7 : 0.5); },
    get stars() { return stars; },
    destroy() { for (const x of texts) x.t.destroy(); for (const t of textPool) t.destroy(); },
  };
}
