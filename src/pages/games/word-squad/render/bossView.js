// src/pages/games/word-squad/render/bossView.js
// The three bosses, put together from their parts (art.js) so they can breathe,
// flap, drum and stomp. Positions are in the parts' own art pixels.
import { Container, Graphics, Sprite, BitmapText } from 'pixi.js';

function part(atlas, name, x, y, ax = 0.5, ay = 0.5, flip = false) {
  const art = atlas.get(name);
  const s = new Sprite(art.texture);
  s.anchor.set(ax, ay);
  s.scale.set(art.inv * (flip ? -1 : 1), art.inv);
  s.position.set(x, y);
  return s;
}

const BUILD = {
  queen(atlas) {
    const wingL = part(atlas, 'queenWingL', -40, -230, 0.95, 0.8);
    const wingR = part(atlas, 'queenWingL', 40, -230, 0.95, 0.8, true);
    const body = part(atlas, 'queenBody', 0, 0, 0.5, 1);
    const crown = part(atlas, 'queenCrown', 0, -262, 0.5, 1);
    return { parts: [wingL, wingR, body, crown], wingL, wingR, body, crown, top: -300 };
  },
  bongo(atlas) {
    const armL = part(atlas, 'bongoArmL', -135, -215, 0.5, 0.08);
    const armR = part(atlas, 'bongoArmL', 135, -215, 0.5, 0.08, true);
    const body = part(atlas, 'bongoBody', 0, 0, 0.5, 1);
    const crown = part(atlas, 'bongoCrown', 0, -268, 0.5, 1);
    return { parts: [body, armL, armR, crown], armL, armR, body, crown, top: -330 };
  },
  rex(atlas) {
    const tail = part(atlas, 'rexTail', 110, -60, 0.1, 0.7);
    const body = part(atlas, 'rexBody', 0, 0, 0.5, 1);
    const armL = part(atlas, 'rexArm', -95, -150, 0.8, 0.4, true);
    const armR = part(atlas, 'rexArm', 95, -150, 0.8, 0.4);
    return { parts: [tail, body, armL, armR], tail, body, armL, armR, top: -340 };
  },
};

export function createBossView(atlas, kind, name) {
  const root = new Container();
  const rig = new Container();
  const v = BUILD[kind](atlas);
  rig.addChild(...v.parts);
  root.addChild(rig);

  // Health bar + big number (not scaled with depth — always readable)
  const hud = new Container();
  const bar = new Graphics();
  const hpText = new BitmapText({ text: '0', style: { fontFamily: 'WSNum', fontSize: 34 } });
  hpText.anchor.set(0.5, 1);
  hpText.y = -16;
  const nameText = new BitmapText({ text: name.toUpperCase(), style: { fontFamily: 'WSComic', fontSize: 26 } });
  nameText.anchor.set(0.5, 1);
  nameText.y = -54;
  hud.addChild(bar, hpText, nameText);

  let shownHp = -1;
  let hpThrottle = 0;

  return {
    root,
    hud,
    top: v.top,
    /** t = time, attack = kind of the telegraph in progress (or null) */
    update(boss, t, dt, attack) {
      const breathe = Math.sin(t * 2.2) * 0.02;
      rig.scale.set(1 + breathe, 1 - breathe);
      const hit = boss.flashT > 0;
      for (const p of v.parts) p.tint = hit ? 0xffc4c4 : 0xffffff;

      if (kind === 'queen') {
        const flap = Math.sin(t * 18) * 0.25;
        v.wingL.rotation = -0.2 + flap;
        v.wingR.rotation = 0.2 - flap;
        v.crown.y = -262 + Math.sin(t * 3) * 4;
      } else if (kind === 'bongo') {
        const drum = attack === 'drum' ? Math.sin(t * 26) * 0.5 : Math.sin(t * 2.5) * 0.12;
        v.armL.rotation = 0.55 + drum;
        v.armR.rotation = -0.55 - drum;
        if (attack === 'gumball') { v.armL.rotation = 2.6; v.armR.rotation = -2.6; } // arms up, ready to throw
        v.crown.y = -268 + Math.abs(Math.sin(t * 3)) * -6;
      } else if (kind === 'rex') {
        v.tail.rotation = Math.sin(t * 3) * 0.2;
        const wave = attack === 'goo' ? 0.5 : 0;
        v.armL.rotation = -0.2 + Math.sin(t * 4) * 0.15 - wave;
        v.armR.rotation = 0.2 - Math.sin(t * 4) * 0.15 + wave;
        rig.y = attack === 'stomp' ? -Math.abs(Math.sin(t * 9)) * 26 : 0;
      }

      if (boss.state === 'dying') {
        rig.x = (Math.random() - 0.5) * 16;
        root.alpha = Math.max(0, Math.min(1, boss.dyingT / 0.8));
      }

      hpThrottle -= dt;
      const hp = Math.max(0, Math.ceil(boss.hp));
      if (hp !== shownHp && (hpThrottle <= 0 || hp === 0)) {
        hpThrottle = 0.08;
        shownHp = hp;
        hpText.text = String(hp);
        const f = boss.maxHp > 0 ? Math.max(0, Math.min(1, boss.hp / boss.maxHp)) : 0;
        bar.clear();
        bar.roundRect(-130, -12, 260, 22, 11).fill(0x2a1f45);
        if (f > 0) bar.roundRect(-127, -9, Math.max(16, 254 * f), 16, 8).fill(f > 0.5 ? 0x22c55e : f > 0.25 ? 0xffb703 : 0xef4444);
        bar.roundRect(-127, -9, 254, 6, 3).fill({ color: 0xffffff, alpha: 0.25 });
      }
      hud.visible = boss.state === 'fight' || boss.state === 'enter';
    },
    destroy() { root.destroy({ children: true }); hud.destroy({ children: true }); },
  };
}
