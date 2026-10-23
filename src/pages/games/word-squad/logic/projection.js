// src/pages/games/word-squad/logic/projection.js
// Perspective road camera. A point on the ground at (x, rz) — rz is the
// distance ahead of the squad — maps to a screen point. The camera sits low,
// just behind the squad ("over the shoulder"), so the road rushes toward you,
// fills the screen width, and gates and bosses loom up face to face.
// Logical screen: LOGICAL_H high, width depends on the aspect ratio.

export const LOGICAL_H = 960;
export const PORTRAIT_W = 540;
export const MAX_W = 1800;

const HORIZON_Y = 400;
export const CAM_BACK = 2.2;   // camera sits this far behind the squad
const Y_K = 790;               // ground drop (camera height × focal) — low camera, squad near the bottom
export const X_K = 400;        // road spread (focal) — the road fills a phone screen at the squad
/** Screen px per world unit across the road, at the squad's depth */
export const PX_PER_UNIT = X_K / CAM_BACK;

export function logicalWidth(screenW, screenH) {
  const w = Math.round((LOGICAL_H * screenW) / Math.max(1, screenH));
  return Math.min(MAX_W, Math.max(PORTRAIT_W, w));
}

/** Sprite scale at this distance: 1 at the squad, smaller toward the horizon. */
export const depthScale = (rz) => CAM_BACK / Math.max(0.35, rz + CAM_BACK);

export function project(x, rz, width) {
  const d = Math.max(0.35, rz + CAM_BACK);
  return {
    x: width / 2 + (x * X_K) / d,
    y: HORIZON_Y + Y_K / d,
    s: CAM_BACK / d,
  };
}

/** Screen x (at the squad's depth) back to world x — used for finger dragging. */
export const screenDxToWorld = (dx) => (dx * CAM_BACK) / X_K;

export const horizonY = HORIZON_Y;
