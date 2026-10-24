// src/pages/games/word-squad/logic/config.js
// Tuning numbers for Word Squad. World units: x runs across the road
// (−ROAD_HALF … +ROAD_HALF), z runs up the road. Everything here is plain data
// so the simulation can be unit tested without a renderer.

export const SPEED = 0.8;            // squad forward speed, world units / s
export const ROAD_HALF = 1.5;        // road is x ∈ [−1.5, 1.5]
export const VIEW_DIST = 14;         // things appear this far ahead of the squad
export const STEER_SPEED = 2.4;      // keyboard steering, units / s
export const START_SQUAD = [1, 1, 1]; // by chapter — every chapter starts with one soldier who multiplies
export const MAX_SQUAD = 150;
export const QUESTION_LEAD_S = 7;    // a question shows at least this long before its gate
export const COMBO_WINDOW = 0.3;     // kills this close together chain into a combo
export const CORRECT_SHOW_S = 2;     // after a wrong answer the right word stays this long

// Device budgets (the renderer picks 'phone' on small / touch screens)
export const ENEMY_CAP = { desktop: 120, phone: 80 };
export const PARTICLE_CAP = { desktop: 900, phone: 400 };

// Squad formation (sunflower spiral). Only this many soldiers are drawn;
// the count bubble shows the real number.
export const VISIBLE_SOLDIERS = 40;
export const FORMATION_STEP = 0.085;

// dps = damage per second per soldier. shooters = soldiers that visibly fire.
export const WEAPONS = {
  blaster: { name: 'Blaster',        dps: 2.0, rate: 3.2, streams: 1, range: 5.0, speed: 9,   spread: 0.02 },
  double:  { name: 'Double Blaster', dps: 3.0, rate: 3.2, streams: 2, range: 5.1, speed: 9.5, spread: 0.02 },
  minigun: { name: 'Minigun',        dps: 3.8, rate: 9,   streams: 1, range: 5.3, speed: 11,  spread: 0.12 },
  laser:   { name: 'Mega Laser',     dps: 4.2, beam: true,            range: 5.6, width: 0.36 },
  rockets: { name: 'Rockets',        dps: 3.6, rate: 1.1, streams: 1, range: 5.8, speed: 5,   spread: 0.04, splash: 0.7 },
};
export const WEAPON_UPGRADES = ['double', 'minigun', 'laser', 'rockets'];
export const MAX_SHOOTERS = 6;
export const BASE_POWER = 8;         // firepower = soldiers + this
export const AIM_ASSIST = 0.3;       // share of the way bullets bend toward the nearest bug ahead

// Bugs. hp is multiplied by the chapter factor; angry ones have ×1.5 hp and +20% speed.
export const SPECIES = {
  beetle:    { hp: 1.5,  speed: 0.55, radius: 0.13 },
  bee:       { hp: 1,   speed: 0.8,  radius: 0.11 },
  snail:     { hp: 3,    speed: 0.3,  radius: 0.14 },
  spiderbot: { hp: 2,    speed: 0.6,  radius: 0.13 },
};
export const CHAPTER_HP = [1, 1.1, 1.25];
export const SWARM_SIZES = [20, 35, 50, 70];
export const SWARM_BOOST_PER_WRONG = 0.5;
export const SWARM_BOOST_MAX = 1.5;

export const MINI_BOSS = { hp: 25, speed: 0.25, radius: 0.32, hitSoldiers: 3 };
export const CRATE = { hp: 14, radius: 0.22, laneX: 1.05, hitSoldiers: 2 };

// Rewards on a right answer (weights add to 100)
export const REWARD_WEIGHTS = { weapon: 55, friends: 30, double: 15 };
export const SAME_WEAPON_FRIENDS = 4;

export const BOSSES = [
  { kind: 'queen', name: 'Queen Bug',  hp: 3600, attackEvery: 3.6, hitSoldiers: 3 },
  { kind: 'bongo', name: 'Bongo',      hp: 3800, attackEvery: 3.6, hitSoldiers: 3 },
  { kind: 'rex',   name: 'Kaiju Rex',  hp: 5600, attackEvery: 3.3, hitSoldiers: 4 },
];
export const BOSS_HOLD_Z = 4.6;       // the boss stands this far ahead (inside every weapon's range)
export const BOSS_RADIUS = 0.9;
export const TELEGRAPH_S = 1.0;
export const WRONG_IN_BOSS_HP = 0.15; // a wrong answer during the boss fight: +15% health

export const CHAPTERS = [
  { gates: 10, swarms: 3 },
  { gates: 11, swarms: 4 },
  { gates: 12, swarms: 4 },
];
export const GATE_GAP_S = 16;         // seconds between gates (the next question is never far)
export const FIRST_GATE_S = 8;
export const FIRST_GATE_REWARD = { type: 'friends', amount: 5 }; // the lone soldier's first right word always brings friends
export const STARTER_SAFE_GATES = 3; // until this many gates are passed, hits can't take the last soldier

// ── Batch 1: things to do between gates ─────────────────────────────────────
export const HOMING = 0.3;           // how fast bugs drift sideways toward the squad (units / s)
export const TARGET_CONE = 0.9;      // bullets only aim at bugs within this far to the side — line up to shoot
// Spinners (candy pinwheels moving side to side) and gumdrop walls with one gap
export const OBSTACLES = {
  spinner: { r: 0.2, hitSoldiers: 2, speed: [1.1, 1.4, 1.8], amp: 0.95 },
  wall: { hitSoldiers: 2, gap: [1.15, 1.0, 0.9] },
};
export const PICKUP = { r: 0.18, friends: 3, shieldS: 6, frenzyS: 6, frenzyBoost: 1.6 };
export const SPELL = { spacing: 1.3, friends: 4, coins: 3, words: ['CAT', 'SUN', 'BOOK', 'TREE', 'FISH', 'STAR', 'MILK', 'BIRD'] };

// ── Batch 1: boss rework ────────────────────────────────────────────────────
export const BOSS_SHOT_SPEED = 5.5;  // lane attacks travel down the road this fast after the wind-up
export const GUMBALL_FLIGHT = 1.0;   // seconds a gumball is in the air
export const WEAK_SPOT = { secs: 2.2, mult: 3, width: 0.3 };
export const BOSS_SHIELD = { damage: 0.25, breakHit: 0.15 }; // shield: ×0.25 damage; the right word breaks it for 15%
export const ENRAGE_AT = [2 / 3, 1 / 3];
export const REVIVE_SQUAD = 6;

// ── Speed and danger (low-camera update) ────────────────────────────────────
// Every right answer speeds the squad up a little; wrong answers bring big
// floods, and after a couple of mistakes some bugs start shooting goo.
export const SPEED_PER_RIGHT = 0.07;  // +7% per right word…
export const SPEED_MAX = 1.6;         // …up to 1.6× the start speed
export const WRONG_SWARM = { base: 12, perChapter: 4, perSoldier: 1.1, min: 5 }; // scaled to the squad, so a tiny squad isn't wiped out
export const BUILD_UP_GATES = 3;   // the first gates give friends instead of weapons (a lone soldier needs a squad first)
export const SHOOTERS = {
  fromWrong: 2,          // bugs start shooting after this many wrong words
  chancePerWrong: 0.15,  // share of new bugs that shoot: 15% at 2 wrong, 30% at 3…
  maxChance: 0.6,
  every: [2.4, 3.6],     // seconds between shots
  aim: 0.45,             // the bug swells and glows this long before it spits
  shotSpeed: 2.6,        // goo travels toward the squad at this speed
  range: [1.6, 9],       // only bugs this far ahead shoot (beyond the squad's reach, so they get a shot off)
  hitSoldiers: 1,
};

// ── Flying bomber bosses (twice per chapter, before the chapter boss) ───────
// A flying bug hovers ahead and drops candy bombs: each bomb's landing spot
// glows on the road while it falls, so the squad can step aside.
export const FLYERS = {
  mini: { name: 'Buzz Bomber', hp: 650, hitSoldiers: 1, bombEvery: 2.0, bombs: 1, helpers: 0, reward: { type: 'friends', amount: 6 }, coins: 4, scale: 1 },
  big:  { name: 'Mega Buzz Bomber', hp: 1400, hitSoldiers: 2, bombEvery: 2.4, bombs: 3, helpers: 6, reward: { type: 'double' }, coins: 8, scale: 1.45 },
  holdZ: 4.3,          // hovers this far ahead (inside every weapon's reach)
  radius: 0.65,        // how wide it is for bullets
  bombFall: 1.1,       // seconds a bomb is in the air
  bombRadius: 0.36,
  leaveAfter: 32,      // seconds before an undefeated bomber flies away
};
