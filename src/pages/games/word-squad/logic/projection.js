// src/pages/games/word-squad/logic/projection.js
// Perspective road camera. A point on the ground at (x, rz) — rz is the
// distance ahead of the squad — maps to a screen point. The squad (rz = 0)
// stands near the bottom; the horizon is a fixed line across the screen.
// Logical screen: LOGICAL_H high, width depends on the aspect ratio.

export const LOGICAL_H = 960;
export const PORTRAIT_W = 540;
export const MAX_W = 1800;

const HORIZON_Y = 300;
const CAM_BACK = 2.2;   // camera sits this far behind the squad
const Y_K = 1040;       // ground drop  (camera height × focal)
const X_K = 330;        // road spread  (focal)

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
