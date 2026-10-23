// src/pages/games/word-squad/logic/rewards.js
// What a right answer gives. The reward is chosen when the gate is made (it is
// shown on the badge before the gate); applying it checks the squad as it is then.
import { weightedPick } from './rng.js';
import { REWARD_WEIGHTS, WEAPON_UPGRADES, SAME_WEAPON_FRIENDS, MAX_SQUAD } from './config.js';

export function rollReward(rng) {
  const type = weightedPick(rng, REWARD_WEIGHTS);
  if (type === 'weapon') return { type: 'weapon', weapon: rng.pick(WEAPON_UPGRADES) };
  if (type === 'friends') return { type: 'friends', amount: rng.int(4, 10) };
  return { type: 'double' };
}

/** The reward as it would land right now (a weapon the squad already has becomes friends). */
export function effectiveReward(reward, weapon) {
  if (reward?.type === 'weapon' && reward.weapon === weapon) {
    return { type: 'friends', amount: SAME_WEAPON_FRIENDS, converted: true };
  }
  return reward;
}

/** Returns the squad after the reward: { count, weapon } */
export function applyReward(squad, reward) {
  const r = effectiveReward(reward, squad.weapon);
  if (!r) return { ...squad };
  if (r.type === 'weapon')  return { ...squad, weapon: r.weapon };
  if (r.type === 'friends') return { ...squad, count: Math.min(MAX_SQUAD, squad.count + r.amount) };
  if (r.type === 'double')  return { ...squad, count: Math.min(MAX_SQUAD, squad.count * 2) };
  return { ...squad };
}

export function rewardLabel(reward, weapon) {
  const r = effectiveReward(reward, weapon);
  if (!r) return '';
  if (r.type === 'weapon')  return { double: 'Double Blaster', minigun: 'Minigun', laser: 'Mega Laser', rockets: 'Rockets' }[r.weapon];
  if (r.type === 'friends') return `+${r.amount} friends`;
  return '×2 squad';
}
