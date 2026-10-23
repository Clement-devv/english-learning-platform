// src/pages/games/word-squad/render/gateView.js
// A Word Gate in the world: translucent panels across the road, one word each
// in big outlined letters, and the reward badge above. Built once per gate,
// then only moved, scaled and highlighted.
import { Container, Graphics, Sprite, Text } from 'pixi.js';
import { rewardLabel, effectiveReward } from '../logic/rewards.js';

const ROAD_PX = 450;          // road width in px at scale 1 (2 × ROAD_HALF × X_K / CAM_BACK)
const PANEL_H = 112;
const COLORS = [0x4cc9f0, 0xb388ff, 0x06d6a0];
const FONT = 'Nunito, "Arial Rounded MT Bold", Arial, sans-serif';

function badgeIcon(reward, weapon) {
  const r = effectiveReward(reward, weapon);
  if (r?.type === 'weapon') return `icon_${r.weapon}`;
  if (r?.type === 'double') return 'iconDouble';
  return 'iconFriends';
}

export function createGateView(atlas, gate, weapon) {
  const root = new Container();
  const n = gate.n;
  const pw = ROAD_PX / n;
  const panels = [];

  // Side posts
  for (const side of [-1, 1]) {
    const post = new Graphics();
    post.roundRect(side * (ROAD_PX / 2) - 9, -PANEL_H - 26, 18, PANEL_H + 26, 8).fill(0xffffff).stroke({ width: 4, color: 0x2a1f45 });
    post.circle(side * (ROAD_PX / 2), -PANEL_H - 30, 12).fill(0xff5d8f).stroke({ width: 4, color: 0x2a1f45 });
    root.addChild(post);
  }

  for (let i = 0; i < n; i++) {
    const cx = -ROAD_PX / 2 + pw * (i + 0.5);
    const c = new Container();
    c.x = cx;
    const base = new Graphics();
    base.roundRect(-pw / 2 + 6, -PANEL_H, pw - 12, PANEL_H - 6, 18).fill({ color: COLORS[i % 3], alpha: 0.42 }).stroke({ width: 5, color: 0xffffff, alpha: 0.95 });
    base.roundRect(-pw / 2 + 14, -PANEL_H + 8, pw - 28, 14, 7).fill({ color: 0xffffff, alpha: 0.35 });
    const glow = new Graphics();
    glow.roundRect(-pw / 2 + 2, -PANEL_H - 4, pw - 4, PANEL_H + 2, 22).stroke({ width: 8, color: 0xffd166 });
    glow.visible = false;
    const result = new Graphics();
    result.visible = false;
    const word = new Text({
      text: gate.choices[i],
      style: { fontFamily: FONT, fontSize: 44, fontWeight: '900', fill: 0xffffff, stroke: { color: 0x2a1f45, width: 9, join: 'round' } },
      resolution: 2,
    });
    word.anchor.set(0.5);
    word.y = -PANEL_H / 2 - 3;
    const maxW = pw - 28;
    if (word.width > maxW) word.scale.set(maxW / word.width);
    c.addChild(base, result, glow, word);
    root.addChild(c);
    panels.push({ c, glow, result, word, w: pw });
  }

  // Reward badge
  const badge = new Container();
  badge.y = -PANEL_H - 62;
  const pill = new Graphics();
  const icon = new Sprite();
  icon.anchor.set(0.5);
  const label = new Text({ text: '', style: { fontFamily: FONT, fontSize: 26, fontWeight: '900', fill: 0x2a1f45 }, resolution: 2 });
  label.anchor.set(0, 0.5);
  badge.addChild(pill, icon, label);
  root.addChild(badge);

  let shownWeapon = null;
  function setBadge(w) {
    if (w === shownWeapon) return;
    shownWeapon = w;
    const art = atlas.get(badgeIcon(gate.reward, w));
    icon.texture = art.texture;
    icon.scale.set(art.inv);
    label.text = rewardLabel(gate.reward, w).toUpperCase();
    const width = 52 + label.width + 18;
    pill.clear();
    pill.roundRect(-width / 2, -26, width, 52, 26).fill(0xfff7d6).stroke({ width: 4, color: 0x2a1f45 });
    icon.x = -width / 2 + 28;
    label.x = -width / 2 + 52;
  }
  setBadge(weapon);

  let shownLane = -1;
  let shownResult = null;

  return {
    root,
    update(g, squadWeapon, lane) {
      if (g.state === 'coming') {
        setBadge(squadWeapon);
        if (lane !== shownLane) {
          shownLane = lane;
          panels.forEach((p, i) => { p.glow.visible = i === lane; p.c.scale.set(i === lane ? 1.04 : 1); });
        }
      } else if (g.state === 'done' && shownResult === null) {
        shownResult = g.correct;
        panels.forEach((p, i) => {
          p.glow.visible = false;
          p.c.scale.set(1);
          const isChoice = i === g.choice;
          const isAnswer = g.choices[i] === g.correctAnswer;
          if (isChoice || isAnswer) {
            p.result.clear();
            p.result.roundRect(-p.w / 2 + 6, -PANEL_H, p.w - 12, PANEL_H - 6, 18).fill({ color: isAnswer ? 0x22c55e : 0xef4444, alpha: 0.7 });
            p.result.visible = true;
          } else {
            p.c.alpha = 0.45;
          }
        });
        badge.visible = false;
      }
    },
    destroy() { root.destroy({ children: true }); },
  };
}
