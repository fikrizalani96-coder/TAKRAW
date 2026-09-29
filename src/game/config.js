// ISTAF dimensions and tuning constants (metres, kilograms, seconds).
// World axes: X = across the court (+X is the right of the user's camera), Y = up, Z = along the court.
// The net lies on the plane z = 0. The user's team defends z > 0 (near the camera), the opponent z < 0.

export const COURT = {
  L: 13.4, W: 6.1, halfL: 6.7, halfW: 3.05,
  lineW: 0.04,
  serviceCircleR: 0.30, serviceFromBack: 2.45,      // centre of service circle: 2.45 m from the back line, on the centre line
  quarterR: 0.90,                                    // quarter circles at the net corners
  netTop: { men: 1.52, women: 1.42 }, postH: { men: 1.55, women: 1.45 },
  netWidth: 0.70, postOffset: 0.30, tape: 0.05,
  freeZone: 3.0, ceiling: 8.0,
};
export const BALL_SPEC = {
  men: { r: 0.0668, m: 0.175, circ: 0.42 },          // 41-43 cm, 170-180 g
  women: { r: 0.0684, m: 0.155, circ: 0.43 },        // 42-44 cm, 150-160 g
  cd: 0.42, rho: 1.2, magnus: 0.0028, spinDecay: 0.35,
};
export const SURFACES = {
  official: { restitution: 0.66, friction: 0.42, roll: 0.55, label: 'Synthetic court' },
  kampung: { restitution: 0.50, friction: 0.62, roll: 1.4, label: 'Packed earth' },
};
export const MATCH_FORMATS = {
  istaf: { label: 'ISTAF Regu (best of 3 sets)', setsToWin: 2, points: [21, 21, 15], cap: [25, 25, 17], deuce: [20, 20, 14] },
  quick: { label: 'Quick Match (1 set to 11)', setsToWin: 1, points: [11], cap: [13], deuce: [10] },
  kampung: { label: 'Kampung Rules (1 set to 15)', setsToWin: 1, points: [15], cap: [17], deuce: [14] },
};
export const ROLES = { TEKONG: 'tekong', TOSSER: 'tosser', KILLER: 'killer' };
export const G = 9.81;
export const PHYS_DT = 1 / 240;
