// Non-foot ball contacts: head, chest, thigh, knee, shoulder, back. Parametrised by ball
// height, lateral offset and stance style, with a small hop/jump for high balls.
import * as THREE from 'three';
import { P, CH } from '../pose.js';
import { READY, STANCE_LOW, HAND, KB, flatFeet, solveLeg, other, sideSign, D2R, clampN, LEN } from '../authoring.js';
import { register } from '../clip.js';

const LEGN = { L: 'left', R: 'right' };

/** kind: head|chest|thigh|knee|shoulder|back. p: {T:[x,y,z], side, tc, style, power} */
export function makeBodyContact(p) {
  const kind = p.kind, [tx, ty, tz] = p.T;
  const s = p.side || 'R', ps = other(s), sd = sideSign(s);
  const tc = p.tc ?? 0.3, power = p.power ?? 0.4, style = p.style ?? 'stand';
  const base = p.base ?? READY;
  const kb = new KB(base);
  const yawTo = Math.atan2(tx, Math.max(0.15, tz)) / D2R;   // degrees
  const jump = style === 'jump' ? 1 : 0;
  const t1 = tc * 0.5, t2 = tc * 0.85, t3 = tc, t4 = tc + 0.1, t5 = tc + 0.28, t6 = tc + 0.5;

  kb.at(0, {});
  let load, contact, follow;
  const armsBalance = (o, wide = 1) => { for (const sdz of ['L', 'R']) { o[CH['sh_f_' + sdz]] = 20 * D2R; o[CH['sh_a_' + sdz]] = (28 + 30 * wide) * D2R; o[CH['el_f_' + sdz]] = 40 * D2R; } return o; };

  if (kind === 'head') {
    load = P({ spine: [-8, 0, 0], chest: [-6, 0, 0], neck: [12, 0, 0], head: [-10, 0, 0], LR: { hp_f: 48 + 12 * jump, kn_f: 84 + 14 * jump, hp_a: 10, sh_f: -18, sh_a: 34, el_f: 30 }, yaw: -yawTo * 0.3 }, base);
    flatFeet(load); kb.push(t1, load);
    contact = P({ spine: [22 + 8 * clampN(1.9 - ty, 0, 1), 0, 0], chest: [10, 0, 0], neck: [18, 0, 0], head: [12, 0, 0], yaw: yawTo * 0.5, pitch: 4,
      LR: { hp_f: 10 + 12 * jump, kn_f: 6 + 30 * jump, hp_a: 8, sh_f: 30, sh_a: 62, el_f: 26, fa_p: 20 }, face: { jaw: 0.2 } }, base);
    flatFeet(contact); armsBalance(contact, 1.4);
    kb.push(t3, contact, 1.2);
    follow = P({ spine: [14, 0, 0], neck: [8, 0, 0], yaw: yawTo * 0.4, LR: { hp_f: 24, kn_f: 40, sh_a: 40, sh_f: 30, el_f: 50 } }, base); flatFeet(follow);
    kb.push(t4, follow);
  } else if (kind === 'chest') {
    load = P({ spine: [10, 0, 0], chest: [2, 0, 0], neck: [-8, 0, 0], LR: { hp_f: 34, kn_f: 60, hp_a: 12, sh_a: 42, sh_f: 18, el_f: 50 } }, base); flatFeet(load); kb.push(t1, load);
    // chest "cushion": chest hollows back, arms wide and clear of the ball
    contact = P({ spine: [-14, 0, 0], chest: [-16, 0, -sd * 4 + yawTo * 0.3], neck: [-8, 0, 0], head: [-4, 0, 0], pitch: -6, yaw: yawTo * 0.4, hz: -0.03,
      LR: { hp_f: 24 + 8 * (1 - ty), kn_f: 46 + 14 * (1 - ty), hp_a: 12, sh_f: 38, sh_a: 70, el_f: 20, wr_f: -10 } }, base);
    flatFeet(contact);
    kb.push(t3, contact, 1.2);
    follow = P({ spine: [6, 0, 0], neck: [-8, 0, 0], LR: { hp_f: 30, kn_f: 54, sh_a: 48, sh_f: 30, el_f: 40 } }, base); flatFeet(follow); kb.push(t4, follow);
  } else if (kind === 'thigh' || kind === 'knee') {
    const hi = clampN((ty - 0.35) / 0.8, 0, 1);
    load = P({ spine: [8, 0, 0], neck: [-10, 0, 0], [s]: { hp_f: 24, kn_f: 60 }, [ps]: { hp_f: 34, kn_f: 58 }, LR: { sh_a: 40, sh_f: 30, el_f: 50 } }, base); flatFeet(load); kb.push(t1, load);
    const isKnee = kind === 'knee';
    contact = P({ spine: [isKnee ? 4 : -4, 0, sd * 4 + yawTo * 0.2], neck: [-10, 0, 0], yaw: yawTo * 0.4, roll: sd * 2,
      [s]: { hp_f: (isKnee ? 50 : 68) + 34 * hi, kn_f: isKnee ? 100 - 20 * hi : 82 - 10 * hi, hp_a: 8 + Math.abs(tx) * 20, hp_r: sd * -6, an_p: 24 },
      [ps]: { hp_f: 16 - 6 * hi, kn_f: 20, hp_a: 5 }, LR: { sh_a: 50, sh_f: 22, el_f: 40 } }, base);
    contact[CH['an_p_' + ps]] = contact[CH['hp_f_' + ps]] - contact[CH['kn_f_' + ps]] - contact[CH.pitch];
    contact[CH['sh_f_' + other(s)]] = 46 * D2R;
    kb.push(t3, contact, 1.2);
    follow = P({ spine: [8, 0, 0], [s]: { hp_f: 32, kn_f: 70 }, [ps]: { hp_f: 24, kn_f: 30 }, LR: { sh_a: 40, sh_f: 30, el_f: 46 } }, base);
    follow[CH['an_p_' + ps]] = follow[CH['hp_f_' + ps]] - follow[CH['kn_f_' + ps]]; kb.push(t4, follow);
  } else if (kind === 'shoulder') {
    load = P({ spine: [12, 0, 0], LR: { hp_f: 38, kn_f: 64 } }, base); flatFeet(load); kb.push(t1, load);
    contact = P({ spine: [12, -sd * 10, -sd * 20], chest: [6, -sd * 6, -sd * 24], neck: [4, sd * 12, 0], yaw: -sd * 17 + yawTo * 0.3, roll: -sd * 5,
      LR: { hp_f: 28, kn_f: 44, hp_a: 12, sh_a: 34, sh_f: 30, el_f: 60 }, [s]: { cl_e: 12, cl_p: 12 } }, base); flatFeet(contact); kb.push(t3, contact, 1.2);
    follow = P({ spine: [8, 0, -sd * 8], LR: { hp_f: 32, kn_f: 52, sh_a: 34, el_f: 60 } }, base); flatFeet(follow); kb.push(t4, follow);
  } else { // back (ball behind: arch and control with the upper back / heel-flick set)
    load = P({ spine: [16, 0, 0], neck: [-6, 0, 0], LR: { hp_f: 40, kn_f: 70, sh_f: 30, sh_a: 34, el_f: 60 } }, base); flatFeet(load); kb.push(t1, load);
    contact = P({ spine: [-22, 0, sd * 12], chest: [-14, 0, sd * 12], neck: [-14, 0, 0], head: [-6, 0, 0], pitch: -10, yaw: yawTo * 0.4,
      LR: { hp_f: 20, kn_f: 36, hp_a: 10, sh_f: 44, sh_a: 60, el_f: 30 } }, base); flatFeet(contact); kb.push(t3, contact, 1.2);
    follow = P({ spine: [-6, 0, 0], LR: { hp_f: 30, kn_f: 56, sh_a: 44, sh_f: 30 } }, base); flatFeet(follow); kb.push(t4, follow);
  }
  const rec = P({}, base); kb.push(t5, rec); kb.push(t6, P({}, base));
  const meta = { contact: { kind, side: (kind === 'thigh' || kind === 'knee' || kind === 'shoulder') ? s : null, t: tc, T: [tx, ty, tz] }, power, style, kind: 'body', surface: kind };
  if (style === 'stand') meta.plant = [{ foot: 'L', t0: 0, t1: tc + 0.2 }, { foot: 'R', t0: 0, t1: tc + 0.2 }];
  if (jump) meta.air = { t0: tc - 0.20, t1: tc + 0.20, peak: 0.16 + 0.14 * clampN((ty - 1.6) / 0.6, 0, 1) };
  return { duration: t6, loop: false, keys: kb.keys, events: { contact: tc, release: tc + 0.04 }, meta };
}

function reg(id, name, cat, params, tags = []) {
  register({ id, name, cat, tags: ['body', params.kind, ...tags], params, dur: params.tc + 0.5, build: () => makeBodyContact(params) });
}

export function registerBodyContacts() {
  // Headers: 4 heights x 3 lateral x 2 styles (stand/jump) x receive/set/attack contexts
  for (const [ctx, cat, tc, power] of [['recv', 'receive', 0.3, 0.3], ['set', 'set', 0.3, 0.3], ['atk', 'attack', 0.32, 0.9]]) {
    for (const h of [1.55, 1.75, 1.95, 2.25]) for (const lx of [-0.3, 0, 0.3]) for (const style of ['stand', 'jump']) {
      if (h < 1.7 && style === 'jump') continue;
      if (h > 2.1 && style === 'stand') continue;
      reg(`${ctx}.head.h${Math.round(h * 100)}.x${Math.round(lx * 100)}.${style}`, `${cat === 'attack' ? 'Header attack' : cat === 'set' ? 'Header set' : 'Header receive'} h${Math.round(h * 100)}cm ${lx < 0 ? 'right' : lx > 0 ? 'left' : 'front'} ${style}`, cat,
        { kind: 'head', T: [lx, h, 0.28], tc, power, style }, ['header']);
    }
  }
  // Chest: 3 heights x 3 lateral x 3 contexts x 2 stances
  for (const [ctx, cat] of [['recv', 'receive'], ['set', 'set'], ['ctl', 'receive']]) for (const h of [1.05, 1.25, 1.42]) for (const lx of [-0.3, 0, 0.3]) for (const style of ['stand', 'lunge']) {
    reg(`${ctx}.chest.h${Math.round(h * 100)}.x${Math.round(lx * 100)}.${style}`, `Chest ${ctx === 'set' ? 'set' : ctx === 'ctl' ? 'control' : 'receive'} h${Math.round(h * 100)}cm ${lx < 0 ? 'right' : lx > 0 ? 'left' : 'front'} ${style}`, cat,
      { kind: 'chest', T: [lx, h, 0.24], tc: 0.28, power: 0.2, style }, ['chest']);
  }
  // Thigh & knee: 4 heights x 2 sides x 3 lateral (each)
  for (const kind of ['thigh', 'knee']) for (const side of ['R', 'L']) for (const h of [0.5, 0.68, 0.86, 1.02]) for (const lx of [-0.25, 0, 0.25]) {
    reg(`recv.${kind}.${side}.h${Math.round(h * 100)}.x${Math.round(lx * 100)}`, `${kind === 'thigh' ? 'Thigh' : 'Knee'} control ${LEGN[side]} h${Math.round(h * 100)}cm`, 'receive', { kind, side, T: [lx, h, 0.3], tc: 0.27, power: 0.3, style: 'stand' }, [kind]);
  }
  // Shoulder & back saves
  for (const side of ['R', 'L']) for (const h of [1.2, 1.4, 1.6]) for (const lx of [-0.3, 0, 0.3]) reg(`recv.shoulder.${side}.h${Math.round(h * 100)}.x${Math.round(lx * 100)}`, `Shoulder save ${LEGN[side]} h${Math.round(h * 100)}cm`, 'receive', { kind: 'shoulder', side, T: [lx, h, 0.2], tc: 0.28, power: 0.3, style: 'stand' }, ['shoulder']);
  for (const h of [1.15, 1.35, 1.55]) for (const lx of [-0.2, 0, 0.2]) reg(`recv.back.h${Math.round(h * 100)}.x${Math.round(lx * 100)}`, `Back control h${Math.round(h * 100)}cm`, 'receive', { kind: 'back', T: [lx, h, -0.25], tc: 0.3, power: 0.3, style: 'stand' }, ['back']);
}
