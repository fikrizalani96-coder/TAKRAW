// Kit materials: garment patterns are evaluated per-pixel from the bind-pose position, so edges
// are razor sharp regardless of mesh resolution (sash, stripes, chevron, panels, cuffs, collar...).
import * as THREE from 'three';

const PATTERNS = { solid: 0, sash: 1, stripes: 2, sides: 3, chevron: 4, gradient: 5 };
const lin = (hex) => { const c = new THREE.Color(hex); return new THREE.Vector3(c.r, c.g, c.b); };

const HEADER = /* glsl */`
varying vec3 vBind;
uniform vec3 uP; uniform vec3 uS; uniform vec3 uT;
uniform int uPattern; uniform float uK; uniform float uHem; uniform float uWaist; uniform float uSleeve; uniform float uNeckY; uniform float uTop;
uniform mat4 uArmL; uniform mat4 uArmR;
float bandAA(float v, float a, float b) { float w = fwidth(v) * 1.1 + 1e-5; return smoothstep(a - w, a + w, v) * (1.0 - smoothstep(b - w, b + w, v)); }
`;

const JERSEY = /* glsl */`
vec3 kitColor(vec3 p) {
  float K = uK; vec3 c = uP;
  float above = step(uHem + 0.02 * K, p.y);
  if (uPattern == 1) {
    float side = p.z >= 0.0 ? 1.0 : -1.0;
    float t = (p.x * 0.75 + (p.y - 1.22 * K) * 0.55) * side;
    c = mix(c, uT, bandAA(abs(t), 0.030, 0.045) * above);
    c = mix(c, uS, bandAA(abs(t), -1.0, 0.030) * above);
  } else if (uPattern == 2) {
    float f = fract((p.x + 0.4) / 0.038);
    c = mix(c, mix(uP, uS, 0.88), bandAA(f, 0.0, 0.5) * above);
  } else if (uPattern == 3) {
    c = mix(c, uS, bandAA(abs(p.x), 0.125 * K, 1.0) * bandAA(p.y, -1.0, 1.36 * K) * bandAA(abs(p.z), -1.0, 0.09));
  } else if (uPattern == 4) {
    float t = p.y - 1.30 * K + abs(p.x) * 0.55;
    c = mix(c, uS, bandAA(t, -0.048, -0.014));
    c = mix(c, uT, bandAA(t, -0.014, 0.006));
  } else if (uPattern == 5) {
    float g = smoothstep(uHem, 1.5 * K, p.y);
    c = mix(uS, uP, smoothstep(0.0, 0.7, g));
  }
  vec4 lp = (p.x > 0.0 ? uArmL : uArmR) * vec4(p, 1.0);
  float cuff = bandAA(lp.y, -uSleeve - 0.02, -uSleeve + 0.028 * K) * step(0.16 * K, abs(p.x)) * step(length(lp.xz), 0.075 * K);
  c = mix(c, uT, cuff);
  float ne = length(vec3(p.x / (0.070 * K), (p.y - (uNeckY + 0.015 * K)) / (0.062 * K), (p.z - 0.040 * K) / (0.115 * K))) - 1.0;
  c = mix(c, uT, bandAA(ne, -0.12, 0.30) * step(1.3 * K, p.y));
  c = mix(c, uT, bandAA(p.y, -10.0, uHem + 0.022 * K));
  float wv = 0.965 + 0.035 * sin(p.x * 300.0) * sin(p.y * 340.0);
  return c * wv;
}`;

const SHORTS = /* glsl */`
vec3 kitColor(vec3 p) {
  float K = uK; vec3 c = uP;
  c = mix(c, uS, bandAA(abs(p.x), 0.105 * K, 1.0) * bandAA(p.y, uHem + 0.05, uWaist - 0.03));
  c = mix(c, uT, bandAA(p.y, uWaist - 0.028, 10.0));
  c = mix(c, uT, bandAA(p.y, -10.0, uHem + 0.02));
  return c * (0.97 + 0.03 * sin(p.x * 280.0) * sin(p.y * 260.0));
}`;
const SOCKS = /* glsl */`
vec3 kitColor(vec3 p) { vec3 c = uP; c = mix(c, uS, bandAA(p.y, uTop - 0.035, 10.0)); c = mix(c, uT, bandAA(p.y, uTop - 0.055, uTop - 0.045)); return c * (0.96 + 0.04 * sin(p.y * 500.0)); }`;
const SHOE = /* glsl */`
vec3 kitColor(vec3 p) {
  vec3 c = uP;
  c = mix(c, uS, bandAA(abs(p.x), 0.034 * uK, 1.0) * bandAA(p.y, 0.022, 0.05));
  c = mix(c, vec3(0.06), bandAA(p.y, 0.072 * uK, 10.0));
  c = mix(c, vec3(0.93), bandAA(p.y, -10.0, 0.0215));
  return c;
}`;
const CHUNK = { jersey: JERSEY, shorts: SHORTS, socks: SOCKS, shoe: SHOE };

/**
 * kind: 'jersey' | 'shorts' | 'socks' | 'shoe'. ctx: {kit, K, cs, armInvL, armInvR}
 */
export function kitMaterial(kind, ctx, rough = 0.85) {
  const { kit, K, cs } = ctx;
  const map = { jersey: [kit.primary, kit.secondary, kit.trim], shorts: [kit.shorts, kit.secondary, kit.trim], socks: [kit.socks, kit.secondary, kit.trim], shoe: [kit.shoe, kit.secondary, kit.trim] };
  const [p, s, t] = map[kind];
  const uniforms = {
    uP: { value: lin(p) }, uS: { value: lin(s) }, uT: { value: lin(t) },
    uPattern: { value: PATTERNS[kit.pattern] ?? 0 }, uK: { value: K },
    uHem: { value: cs?.hemJ ?? cs?.hem ?? 0 }, uWaist: { value: cs?.waist ?? 0 }, uSleeve: { value: cs?.sleeveLen ?? 0 },
    uNeckY: { value: cs?.neckY ?? 1.49 * K }, uTop: { value: ctx.top ?? 0 },
    uArmL: { value: ctx.armInvL ?? new THREE.Matrix4() }, uArmR: { value: ctx.armInvR ?? new THREE.Matrix4() },
  };
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: rough, metalness: 0 });
  mat.customProgramCacheKey = () => 'kit-' + kind;
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, uniforms);
    sh.vertexShader = 'varying vec3 vBind;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n vBind = position;');
    sh.fragmentShader = sh.fragmentShader
      .replace('void main() {', HEADER + CHUNK[kind] + '\nvoid main() {')
      .replace('#include <color_fragment>', `#include <color_fragment>
      diffuseColor.rgb = kitColor(vBind) * vColor.r;`);
  };
  return mat;
}
