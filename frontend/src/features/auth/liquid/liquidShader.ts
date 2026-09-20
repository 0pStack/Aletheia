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
// Frost: the scene on the far side of the lens, shown on the landing page. A ray is marched
// over a ridged-noise height field, so peaks have real slopes: steep faces stay bare rock,
// gentle ones hold snow, the low dawn sun (in the login's own bronze, so both scenes read as
// one world) lights one side of every ridge, and distance fades into haze. The palette is the
// login's, moved outdoors: olive-black rock, bronze light, sage haze, oxblood in the low ground.
// The viewpoint
// drifts slowly forward; uScroll flies it on toward the range and tips it down over it.
//
// Dive (uDive, linear 0..1) pushes the viewpoint into the lens: it grows exponentially, which is
// how a steady push-in reads on screen, while its interior swirls and magnifies. A cold flare
// covers the moment the glass dissolves into the frost scene the landing page starts on.
export const FRAGMENT_SHADER = /* glsl */ `
precision highp float;

uniform vec2 uResolution;
uniform float uTime;
uniform vec2 uPointer;
uniform float uReveal;
uniform vec2 uLensCenter;
uniform float uDive;
uniform float uLight;
uniform float uScroll;
varying vec2 vUv;

${LIQUID_FIELD_GLSL}
const vec3 SKY_HIGH = vec3(0.58, 0.64, 0.6);
const vec3 SKY_LOW = vec3(0.88, 0.8, 0.64);
const vec3 HAZE = vec3(0.74, 0.76, 0.69);
const vec3 ROCK = vec3(0.1, 0.11, 0.085);
const vec3 SNOW = vec3(0.94, 0.92, 0.87);
const vec3 SNOW_SHADE = vec3(0.46, 0.55, 0.56);

float hash2(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

float noise2(vec2 x) {
  vec2 i = floor(x);
  vec2 f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(hash2(i), hash2(i + vec2(1.0, 0.0)), f.x),
    mix(hash2(i + vec2(0.0, 1.0)), hash2(i + vec2(1.0, 1.0)), f.x),
    f.y
  );
}

const mat2 OCTAVE = mat2(1.6, 1.2, -1.2, 1.6);

// Folding the noise around its midpoint turns soft hills into sharp crests. The ground stays
// low near the viewpoint so the range opens up ahead instead of walling the camera in.
float terrainCoarse(vec2 p, float ahead) {
  float height = 0.0;
  float amplitude = 0.5;
  vec2 q = p * 0.32;
  for (int i = 0; i < 3; i++) {
    float n = 1.0 - abs(2.0 * noise2(q) - 1.0);
    height += amplitude * n * n;
    q = OCTAVE * q;
    amplitude *= 0.5;
  }
  return height * 3.1 * smoothstep(0.6, 7.0, ahead);
}

float terrainFine(vec2 p, float ahead) {
  float height = 0.0;
  float amplitude = 0.5;
  vec2 q = p * 0.32;
  for (int i = 0; i < 4; i++) {
    float n = 1.0 - abs(2.0 * noise2(q) - 1.0);
    height += amplitude * n * n;
    q = OCTAVE * q;
    amplitude *= 0.5;
  }
  return height * 3.1 * smoothstep(0.6, 7.0, ahead);
}

vec3 frost(vec2 st, float aspect) {
  float t = uTime * 0.02;
  vec2 uv = vec2(st.x / aspect, st.y);

  vec3 origin = vec3(
    uPointer.x * 0.5,
    1.15 + uScroll * 0.5 - uPointer.y * 0.15,
    uTime * 0.06 + uScroll * 3.5
  );
  vec3 ray = normalize(vec3((uv.x - 0.5) * aspect * 1.05, uv.y - 0.5 + 0.1 - uScroll * 0.22, 1.0));
  vec3 sun = normalize(vec3(0.62, 0.3, 0.72));

  float sunward = max(dot(ray, sun), 0.0);
  vec3 sky = mix(SKY_LOW, SKY_HIGH, smoothstep(-0.05, 0.45, ray.y));
  sky += BRONZE_LIGHT * (pow(sunward, 4.0) * 0.3 + pow(sunward, 40.0) * 0.2);
  float cirrus = smoothstep(0.48, 0.72, fbm(vec3(ray.xy * vec2(2.0, 7.0) / (ray.z + 0.3) + t, t)));
  sky = mix(sky, SNOW, cirrus * 0.28 * smoothstep(0.02, 0.3, ray.y));

  float travelled = 0.3;
  float hit = 0.0;
  for (int i = 0; i < 64; i++) {
    vec3 p = origin + ray * travelled;
    float gap = p.y - terrainCoarse(p.xz, p.z - origin.z);
    if (gap < 0.003 * travelled) {
      hit = 1.0;
      break;
    }
    travelled += gap * 0.42;
    if (travelled > 34.0) break;
  }

  vec3 color = sky;
  if (hit > 0.5) {
    vec3 p = origin + ray * travelled;
    float ahead = p.z - origin.z;
    float e = 0.008 * travelled + 0.004;
    float here = terrainFine(p.xz, ahead);
    vec3 normal = normalize(vec3(
      here - terrainFine(p.xz + vec2(e, 0.0), ahead),
      e,
      here - terrainFine(p.xz + vec2(0.0, e), ahead + e)
    ));

    float diffuse = max(dot(normal, sun), 0.0);
    // Snow settles where the ground is flat enough to hold it, thinning on exposed rock.
    float patchy = noise2(p.xz * 2.2) - 0.5;
    float snow = smoothstep(0.5, 0.82, normal.y + patchy * 0.16);
    float strata = noise2(vec2(p.y * 22.0 + p.x * 1.5, p.z * 1.5));
    vec3 rock = mix(ROCK, TAN * 0.45, strata * 0.5) * (0.7 + 1.2 * strata) * (0.45 + 1.1 * diffuse);
    // Wrapped lighting: snow scatters light, so its shadow side stays blue instead of going dark.
    float wrapped = 0.5 + 0.5 * dot(normal, sun);
    vec3 snowColor = mix(SNOW_SHADE, SNOW, smoothstep(0.35, 0.95, wrapped))
      + BRONZE_LIGHT * pow(diffuse, 2.0) * 0.3;
    color = mix(rock, snowColor, snow);

    float haze = 1.0 - exp(-travelled * 0.12);
    // The login pools oxblood along its lower edge; here it gathers in the near, low ground.
    color += OXBLOOD_GLOW * smoothstep(0.9, 0.1, p.y) * smoothstep(9.0, 2.0, travelled) * 0.55;
    color = mix(color, mix(HAZE, sky, 0.35) + BRONZE_LIGHT * pow(sunward, 4.0) * 0.16, haze);
  }

  float bank = fbm(vec3(st.x * 1.2 + t * 2.0, uv.y * 4.0, t * 1.5));
  color = mix(color, HAZE, smoothstep(0.45, 0.8, bank) * smoothstep(0.62, 0.3, uv.y) * 0.3);

  for (int k = 0; k < 2; k++) {
    float size = 16.0 + float(k) * 14.0;
    vec2 cell = st * size + vec2(t * 6.0 * (1.0 + float(k)), t * 22.0 * (1.0 + 0.5 * float(k)));
    vec2 id = floor(cell);
    float seed = hash(vec3(id, float(k)));
    vec2 offset = (vec2(seed, fract(seed * 7.3)) - 0.5) * 0.6;
    float flake = smoothstep(0.07, 0.0, length(fract(cell) - 0.5 - offset)) * step(0.82, seed);
    color = mix(color, SNOW, flake * 0.55);
  }

  return color;
}

float grain(vec2 coord) {
  return fract(sin(dot(coord + uTime, vec2(12.9898, 78.233))) * 43758.5453);
}

void main() {
  float aspect = uResolution.x / uResolution.y;
  vec2 st = vec2(vUv.x * aspect, vUv.y);
  vec2 field = st * 1.35 + uPointer * 0.08;

  float dive = uDive < 0.5 ? 4.0 * uDive * uDive * uDive : 1.0 - pow(-2.0 * uDive + 2.0, 3.0) / 2.0;
  float light = max(uLight, smoothstep(0.6, 1.0, dive));

  vec3 color = vec3(0.0);
  if (light < 1.0) {
    color = liquid(field, vUv.y);
    float vignette = smoothstep(0.35, 1.25, length((vUv - vec2(0.4, 0.55)) * vec2(aspect, 1.0)));
    color = mix(color, NIGHT, vignette * 0.5);
  }
  if (light > 0.0) color = mix(color, frost(st, aspect), light);

  float minSide = min(aspect, 1.0);
  vec2 restCenter = vec2(uLensCenter.x * aspect, uLensCenter.y) + uPointer * vec2(0.05, -0.05)
    + vec2(sin(uTime * 0.21), cos(uTime * 0.17)) * 0.012;
  vec2 center = mix(restCenter, vec2(aspect * 0.5, 0.5), smoothstep(0.0, 0.75, dive));
  float restRadius = 0.24 * minSide * (0.85 + 0.15 * uReveal);
  float radius = restRadius * exp(dive * 2.9);
  vec2 d = (st - center) / radius;
  float dist = length(d);

  // The lens belongs to the night scene; the frost scene at rest has no glass in it.
  if (dist < 1.0 && uLight < 0.5) {
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
    // The glass dissolves at the end, so the last frame is the frost scene with no lens in it.
    color = mix(color, lens, mask * (1.0 - smoothstep(0.72, 1.0, dive)));
  }

  color += SNOW * smoothstep(0.45, 0.82, dive) * (1.0 - smoothstep(0.82, 1.0, dive)) * 0.4;

  float reveal = smoothstep(0.0, 1.0, uReveal);
  // Only the night scene fades up from black; frost continues a frame already on screen.
  color = mix(NIGHT, color, max(reveal, light));
  color += (grain(gl_FragCoord.xy) - 0.5) * mix(0.07, 0.03, light);

  gl_FragColor = vec4(color, 1.0);
}
`
