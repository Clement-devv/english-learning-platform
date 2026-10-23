// src/pages/games/word-squad/logic/config.js
// Tuning numbers for Word Squad. World units: x runs across the road
// (−ROAD_HALF … +ROAD_HALF), z runs up the road. Everything here is plain data
// so the simulation can be unit tested without a renderer.

export const SPEED = 0.8;            // squad forward speed, world units / s
export const ROAD_HALF = 1.5;        // road is x ∈ [−1.5, 1.5]
export const VIEW_DIST = 14;         // things appear this far ahead of the squad
export const STEER_SPEED = 2.4;      // keyboard steering, units / s
export const START_SQUAD = [8, 10, 12]; // by chapter
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
export const AIM_ASSIST = 0.55;      // share of the way bullets bend toward the nearest bug ahead

// Bugs. hp is multiplied by the chapter factor; angry ones have ×1.5 hp and +20% speed.
export const SPECIES = {
  beetle:    { hp: 1.5,  speed: 0.55, radius: 0.13 },
  bee:       { hp: 1,   speed: 0.8,  radius: 0.11 },
  snail:     { hp: 3,    speed: 0.3,  radius: 0.14 },
  spiderbot: { hp: 2,    speed: 0.6,  radius: 0.13 },
};
export const CHAPTER_HP = [1, 1.1, 1.25];
export const SWARM_SIZES = [20, 35, 50, 70];
export const SWARM_BOOST_PER_WRONG = 0.35;
export const SWARM_BOOST_MAX = 0.7;

export const MINI_BOSS = { hp: 25, speed: 0.25, radius: 0.32, hitSoldiers: 3 };
export const CRATE = { hp: 14, radius: 0.22, laneX: 1.05, hitSoldiers: 2 };

// Rewards on a right answer (weights add to 100)
export const REWARD_WEIGHTS = { weapon: 55, friends: 30, double: 15 };
export const SAME_WEAPON_FRIENDS = 4;

export const BOSSES = [
  { kind: 'queen', name: 'Queen Bug',  hp: 3600, attackEvery: 3.6, hitSoldiers: 3 },
  { kind: 'bongo', name: 'Bongo',      hp: 4600, attackEvery: 3.6, hitSoldiers: 3 },
  { kind: 'rex',   name: 'Kaiju Rex',  hp: 5600, attackEvery: 3.3, hitSoldiers: 4 },
];
export const BOSS_HOLD_Z = 4.6;       // the boss stands this far ahead (inside every weapon's range)
export const BOSS_RADIUS = 0.9;
export const TELEGRAPH_S = 1.0;
export const WRONG_IN_BOSS_HP = 0.15; // a wrong answer during the boss fight: +15% health

export const CHAPTERS = [
  { gates: 6, swarms: 3 },
  { gates: 7, swarms: 4 },
  { gates: 8, swarms: 4 },
];
export const GATE_GAP_S = 26;         // seconds between gates
export const FIRST_GATE_S = 12;
