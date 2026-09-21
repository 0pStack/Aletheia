export const VERTEX_SHADER = /* glsl */ `
attribute vec2 aPosition;
varying vec2 vUv;

void main() {
  vUv = aPosition * 0.5 + 0.5;
  gl_Position = vec4(aPosition, 0.0, 1.0);
}
`

// The night liquid on its own, so the landing scene can show the same field inside the lens it
// came through. Expects a float uTime uniform to be declared before it.
export const LIQUID_FIELD_GLSL = /* glsl */ `
// Palette sampled from monopo.vn's hero: black base, muted tan/bronze and grey-olive ribbons.
const vec3 NIGHT = vec3(0.03, 0.03, 0.026);
const vec3 DEEP_OLIVE = vec3(0.1, 0.12, 0.09);
const vec3 OLIVE = vec3(0.34, 0.4, 0.31);
const vec3 TAN = vec3(0.56, 0.49, 0.3);
const vec3 BRONZE_LIGHT = vec3(0.8, 0.68, 0.45);
// --color-obsidian (oklch 0.14 0.008 30) in sRGB, the landing page's colour before its scene.
const vec3 OBSIDIAN = vec3(0.048, 0.031, 0.029);
const vec3 OXBLOOD_GLOW = vec3(0.3, 0.07, 0.05);

float hash(vec3 p) {
  p = fract(p * 0.3183099 + 0.1);
  p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}

float noise(vec3 x) {
  vec3 i = floor(x);
  vec3 f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(mix(hash(i), hash(i + vec3(1, 0, 0)), f.x), mix(hash(i + vec3(0, 1, 0)), hash(i + vec3(1, 1, 0)), f.x), f.y),
    mix(mix(hash(i + vec3(0, 0, 1)), hash(i + vec3(1, 0, 1)), f.x), mix(hash(i + vec3(0, 1, 1)), hash(i + vec3(1, 1, 1)), f.x), f.y),
    f.z
  );
}

float fbm(vec3 p) {
  float value = 0.0;
  float amplitude = 0.5;
  for (int i = 0; i < 4; i++) {
    value += amplitude * noise(p);
    p = p * 2.03 + vec3(1.7, 9.2, 3.1);
    amplitude *= 0.5;
  }
  return value;
}

mat2 rotate2d(float angle) {
  float s = sin(angle);
  float c = cos(angle);
  return mat2(c, -s, s, c);
}

vec3 liquid(vec2 p, float height) {
  float t = uTime * 0.045;
  float warp = fbm(vec3(p * 0.85, t));
  vec2 q = rotate2d(warp * 4.2) * p;
  vec2 drift = vec2(fbm(vec3(q * 1.1 + 3.3, t * 1.4)), fbm(vec3(q * 1.1 + 7.7, t * 0.8)));

  float phase = (q.x * 1.4 + drift.x * 3.0 + q.y * 0.5) * 2.6 + t * 5.0;

  // Two soft ribbon families over black: wide tan ribbons and thinner grey-olive ones between
  // them. The black gaps between ribbons are what give the flow its depth.
  float tanRibbon = smoothstep(0.5, 0.98, sin(phase) * 0.5 + 0.5);
  float oliveRibbon = smoothstep(0.55, 0.98, sin(phase * 0.8 + 2.4 + drift.y * 2.5) * 0.5 + 0.5);

  vec3 color = mix(NIGHT, DEEP_OLIVE, smoothstep(0.3, 0.7, drift.y) * 0.8);
  color = mix(color, OLIVE, oliveRibbon * (1.0 - tanRibbon) * 0.85);
  color = mix(color, TAN, tanRibbon);
  color = mix(color, BRONZE_LIGHT, pow(tanRibbon, 4.0) * 0.55);

  color = mix(color, NIGHT, smoothstep(0.3, 0.0, height) * 0.65);
  color += OXBLOOD_GLOW * smoothstep(0.38, 0.0, height) * (0.5 + 0.5 * drift.x);
  return color;
}
`

// Liquid: value-noise fbm rotates its own coordinates (domain warping), then soft bands blend
// sage into amber, pooling into oxblood toward the bottom. Lens: a sphere drawn in 2D that
// refracts the same field with a per-channel offset (chromatic dispersion) plus a Fresnel rim.
//
// Dive (uDive, linear 0..1) pushes the viewpoint into the lens: it grows exponentially, which is
// how a steady push-in reads on screen, while its interior swirls and magnifies. A bronze flare
// covers the moment the glass dissolves, and the frame settles to flat obsidian: the colour the
// landing page holds until its own scene fades in, so the hand-off has no third picture in it.
export const FRAGMENT_SHADER = /* glsl */ `
precision highp float;

uniform vec2 uResolution;
uniform float uTime;
uniform vec2 uPointer;
uniform float uReveal;
uniform vec2 uLensCenter;
uniform float uDive;
varying vec2 vUv;

${LIQUID_FIELD_GLSL}
float grain(vec2 coord) {
  return fract(sin(dot(coord + uTime, vec2(12.9898, 78.233))) * 43758.5453);
}

void main() {
  float aspect = uResolution.x / uResolution.y;
  vec2 st = vec2(vUv.x * aspect, vUv.y);
  vec2 field = st * 1.35 + uPointer * 0.08;

  float dive = uDive < 0.5 ? 4.0 * uDive * uDive * uDive : 1.0 - pow(-2.0 * uDive + 2.0, 3.0) / 2.0;
  float settle = smoothstep(0.72, 1.0, dive);

  vec3 color = liquid(field, vUv.y);
  float vignette = smoothstep(0.35, 1.25, length((vUv - vec2(0.4, 0.55)) * vec2(aspect, 1.0)));
  color = mix(color, NIGHT, vignette * 0.5);

  float minSide = min(aspect, 1.0);
  vec2 restCenter = vec2(uLensCenter.x * aspect, uLensCenter.y) + uPointer * vec2(0.05, -0.05)
    + vec2(sin(uTime * 0.21), cos(uTime * 0.17)) * 0.012;
  vec2 center = mix(restCenter, vec2(aspect * 0.5, 0.5), smoothstep(0.0, 0.75, dive));
  float restRadius = 0.24 * minSide * (0.85 + 0.15 * uReveal);
  float radius = restRadius * exp(dive * 2.9);
  vec2 d = (st - center) / radius;
  float dist = length(d);

  if (dist < 1.0) {
    float z = sqrt(1.0 - dist * dist);
    vec3 normal = vec3(d, z);
    float rim = 1.0 - z;
    vec2 bend = normal.xy * rim * restRadius * 3.2 * (1.0 + dive * 1.4);
    vec2 magnified = center - rotate2d(dive * 1.1) * (st - center) * mix(0.55, 0.14, dive);
    vec2 base = magnified * 1.35 + uPointer * 0.08;
    // Sample the lens as if from mid-height so the bottom darkening does not leak into the glass.
    float h = 0.75;
    vec3 lens = vec3(
      liquid(base - bend * 1.0, h).r,
      liquid(base - bend * 0.88, h).g,
      liquid(base - bend * 0.76, h).b
    );

    // Dispersion ring: hue rotates with the angle around the rim, strongest at grazing angles.
    float angle = atan(d.y, d.x);
    vec3 spectrum = 0.5 + 0.5 * cos(angle * 2.0 + uTime * 0.3 + vec3(0.0, 2.1, 4.2));
    float fresnel = pow(rim, 3.0);
    lens = mix(lens, spectrum * BRONZE_LIGHT, fresnel * 0.3);
    lens += BRONZE_LIGHT * fresnel * 0.3;

    vec3 lightDir = normalize(vec3(-0.5, 0.6, 0.62));
    float specular = pow(max(dot(reflect(-lightDir, normal), vec3(0.0, 0.0, 1.0)), 0.0), 90.0);
    lens += BRONZE_LIGHT * specular * 0.6;

    float edgeWidth = 1.5 / (radius * uResolution.y);
    float mask = smoothstep(1.0, 1.0 - edgeWidth, dist) * uReveal;
    // The glass dissolves at the end, so the last frames are the settle with no lens in them.
    color = mix(color, lens, mask * (1.0 - settle));
  }

  color += BRONZE_LIGHT * smoothstep(0.45, 0.82, dive) * (1.0 - smoothstep(0.82, 1.0, dive)) * 0.4;

  float reveal = smoothstep(0.0, 1.0, uReveal);
  color = mix(NIGHT, color, reveal);
  // Grain fades with the settle too: the last frame must match the landing's flat obsidian.
  color += (grain(gl_FragCoord.xy) - 0.5) * 0.07 * (1.0 - settle);
  color = mix(color, OBSIDIAN, settle);

  gl_FragColor = vec4(color, 1.0);
}
`
