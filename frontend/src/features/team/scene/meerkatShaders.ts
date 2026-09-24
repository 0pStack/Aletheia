// GLSL for the team meerkats. Every particle lives in its meerkat's own space: a cube of edge
// CUBE centred on the meerkat, y up, z towards the viewer. The field is sampled there, so turning
// a meerkat means turning the field under its particles, never moving the particles themselves.
//
// The shapes are the technique igloo.inc uses for its social links, rebuilt: particles are drawn
// to the surface of a distance field, kept alive by curl noise, and pushed by a flow field that
// the pointer drags through.

export const SLOT_COUNT = 4
export const SIM_SIZE = 384 // 147 456 particles, 36 864 a meerkat
export const PER_SLOT = (SIM_SIZE * SIM_SIZE) / SLOT_COUNT
export const FLOW_WIDTH = 128
export const FLOW_HEIGHT = 64
// Edge of the cube a meerkat's particles start in and are pulled home to.
export const CUBE = 0.65
// Larger samples more of the field, so the meerkat stands smaller in its cube. The meerkat is
// slim, so it can stand taller than a round shape before the containment cylinder cuts it.
const FIELD_SCALE = '0.95'

const shared = /* glsl */ `
  precision highp sampler3D;
  #define SLOTS ${SLOT_COUNT}
  #define PER_SLOT ${PER_SLOT.toFixed(1)}
  #define CUBE ${CUBE.toFixed(2)}
  #define FIELD_SCALE ${FIELD_SCALE}

  uniform sampler3D tField;
  uniform float uAngle[SLOTS];
  uniform float uStir[SLOTS];

  int slotIndex() {
    float index = floor(gl_FragCoord.y) * resolution.x + floor(gl_FragCoord.x);
    return int(min(floor(index / PER_SLOT), float(SLOTS - 1)));
  }

  mat3 turnY(float angle) {
    float c = cos(angle);
    float s = sin(angle);
    return mat3(c, 0.0, -s, 0.0, 1.0, 0.0, s, 0.0, c);
  }

  // xyz: unit direction away from the surface, in particle space. w: signed distance, in grid
  // widths, negative inside.
  vec4 sampleField(vec3 p, float angle) {
    mat3 turn = turnY(angle);
    vec3 uvw = turn * (p / CUBE) * FIELD_SCALE + 0.5;
    vec4 texel = texture(tField, uvw);
    vec3 away = normalize(texel.rgb * 2.0 - 1.0) * turn;
    return vec4(away, (texel.a * 2.0 - 1.0) * 2.0);
  }
`

// Hashed value noise, curled by finite differences: divergence-free, so the drift swirls instead
// of bunching particles up. The integer mix is Chris Wellons' lowbias32 (public domain).
const curlNoise = /* glsl */ `
  uint mixBits(uint v) {
    v ^= v >> 16u; v *= 0x7feb352du;
    v ^= v >> 15u; v *= 0x846ca68bu;
    v ^= v >> 16u;
    return v;
  }

  float lattice(ivec3 c) {
    uint h = mixBits(uint(c.x) ^ mixBits(uint(c.y) ^ mixBits(uint(c.z))));
    return float(h) * (2.0 / 4294967295.0) - 1.0;
  }

  float valueNoise(vec3 p) {
    ivec3 i = ivec3(floor(p));
    vec3 f = fract(p);
    vec3 u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
    float x00 = mix(lattice(i), lattice(i + ivec3(1, 0, 0)), u.x);
    float x10 = mix(lattice(i + ivec3(0, 1, 0)), lattice(i + ivec3(1, 1, 0)), u.x);
    float x01 = mix(lattice(i + ivec3(0, 0, 1)), lattice(i + ivec3(1, 0, 1)), u.x);
    float x11 = mix(lattice(i + ivec3(0, 1, 1)), lattice(i + ivec3(1, 1, 1)), u.x);
    return mix(mix(x00, x10, u.y), mix(x01, x11, u.y), u.z);
  }

  vec3 potentialLayer(vec3 p) {
    return vec3(
      valueNoise(p),
      valueNoise(p + vec3(31.4, 17.1, 5.9)),
      valueNoise(p + vec3(-11.3, 43.7, 23.2))
    );
  }

  // Time as a fourth dimension: whole layers cross-fade into the next. Sliding one layer through
  // space instead would carry particles along with its swirls, and they drain out of the shape
  // in the direction it slides.
  vec3 potential(vec3 p, float t) {
    float layer = floor(t);
    float f = fract(t);
    vec3 from = potentialLayer(p + layer * vec3(17.3, 31.7, 47.1));
    vec3 to = potentialLayer(p + (layer + 1.0) * vec3(17.3, 31.7, 47.1));
    return mix(from, to, f * f * (3.0 - 2.0 * f));
  }

  vec3 curl(vec3 p, float t) {
    const float e = 0.1;
    vec3 dx = potential(p + vec3(e, 0.0, 0.0), t) - potential(p - vec3(e, 0.0, 0.0), t);
    vec3 dy = potential(p + vec3(0.0, e, 0.0), t) - potential(p - vec3(0.0, e, 0.0), t);
    vec3 dz = potential(p + vec3(0.0, 0.0, e), t) - potential(p - vec3(0.0, 0.0, e), t);
    return vec3(dy.z - dz.y, dz.x - dx.z, dx.y - dy.x) / (2.0 * e);
  }
`

export const velocityShader = /* glsl */ `
  ${shared}
  ${curlNoise}

  uniform sampler2D tHome;
  uniform sampler2D tFlow;
  uniform vec4 uSlots[SLOTS]; // x, y: centre in CSS px from the top-left; z: px per unit
  uniform vec2 uViewport;
  uniform float uTime;
  uniform float uStep;        // frame length in 60 Hz frames
  uniform float uInteract;

  void main() {
    vec2 uv = gl_FragCoord.xy / resolution.xy;
    vec4 pos = texture2D(texturePosition, uv);
    vec4 vel = texture2D(textureVelocity, uv);
    vec4 home = texture2D(tHome, uv);
    int slot = slotIndex();
    vec4 place = uSlots[slot];
    vec4 field = sampleField(pos.xyz, uAngle[slot]);
    float stir = uStir[slot];
    float r1 = fract(home.w * 7.13);
    float r2 = fract(home.w * 13.71);
    float r3 = fract(home.w * 29.37);

    // The pointer's flow where this particle is on screen, turned into particle units.
    vec2 screen = place.xy + vec2(pos.x, -pos.y) * place.z;
    vec2 flow = texture2D(tFlow, vec2(screen.x / uViewport.x, 1.0 - screen.y / uViewport.y)).xy;
    vec2 push = flow * uViewport / max(place.z, 1.0);
    vel.xy += push * 0.11 * uInteract * uStep;
    // Where the flow runs, the pulls home and to the surface ease off, so a swipe tears a streak
    // loose instead of denting the shape.
    float hold = 1.0 - min(length(push) * 6.0, 0.65) * uInteract;

    float drift = 0.0002 * (0.7 + 0.3 * r2) + 0.0004 * stir;
    // Offset per meerkat, so the four do not shimmer in step.
    vec3 noiseAt = pos.xyz * 7.0 + float(slot) * vec3(13.1, 7.3, 5.7);
    vel.xyz += curl(noiseAt, uTime * (0.25 + 0.2 * r1)) * drift * uStep;

    vel.xyz += (home.xyz - pos.xyz) * 0.001 * uStep * hold;

    // Drawn in only from outside: particles whose home is inside stay put and fill the body.
    float pull = 0.0015 * (0.7 + 0.3 * r3) * (field.w > 0.0 ? -0.6 : 0.0);
    vel.xyz += field.xyz * pull * uStep * hold;

    vel.xyz *= pow(0.9, uStep);
    vel.w = mix(vel.w, length(vel.xyz), 1.0 - pow(0.965, uStep));
    gl_FragColor = vel;
  }
`

export const positionShader = /* glsl */ `
  ${shared}

  uniform float uStep;
  uniform vec3 uLight;

  void main() {
    vec2 uv = gl_FragCoord.xy / resolution.xy;
    vec4 pos = texture2D(texturePosition, uv);
    vec4 vel = texture2D(textureVelocity, uv);
    int slot = slotIndex();

    pos.xyz += vel.xyz * uStep;
    // Only a safety net: the field and the pull home already bring every particle back. Set far
    // enough out that a streak torn off by the pointer fades before it could meet it, since a
    // tighter wall shows as a hard edge the streak piles up against.
    pos.y = clamp(pos.y, -0.9, 0.9);
    float radius = length(pos.xz);
    if (radius > 0.9) pos.xz *= 0.9 / radius;

    // Light is worked out here, once per particle, from the field's surface direction: wrapped
    // diffuse with a little bounce, and particles inside the body kept dark.
    vec4 field = sampleField(pos.xyz, uAngle[slot]);
    float facing = dot(uLight, field.xyz);
    float lit = max(0.0, (facing + 0.25) / 1.25) + max(0.0, -facing) * 0.1;
    float shade = mix(lit * 0.2, lit, smoothstep(-0.05, -0.001, field.w));
    // While stirred, the shading holds still, so the scatter does not flicker.
    pos.w = mix(shade, pos.w, uStir[slot]);
    gl_FragColor = pos;
  }
`

export const flowShader = /* glsl */ `
  uniform vec2 uPointer;       // texture uv, y up
  uniform vec2 uPointerMove;   // uv moved since the last frame
  uniform float uAspect;
  uniform float uStep;

  void main() {
    vec2 uv = gl_FragCoord.xy / resolution.xy;
    vec2 here = texture2D(textureFlow, uv).xy;
    // Carried along by itself and fading, so a swipe leaves a wake that runs on and dies away.
    vec2 flow = texture2D(textureFlow, uv - here * uStep).xy * pow(0.94, uStep);
    vec2 offset = uv - uPointer;
    offset.x *= uAspect;
    flow += uPointerMove * exp(-dot(offset, offset) / 0.0016);
    gl_FragColor = vec4(flow, 0.0, 1.0);
  }
`

export const pointsVertexShader = /* glsl */ `
  #define SLOTS ${SLOT_COUNT}

  uniform sampler2D tPosition;
  uniform sampler2D tVelocity;
  uniform vec4 uSlots[SLOTS];
  uniform float uPointScale;
  uniform float uPixelRatio;

  attribute vec2 reference;
  attribute float slot;

  varying float vShade;
  varying float vSpeed;

  void main() {
    vec4 pos = texture2D(tPosition, reference);
    vec4 place = uSlots[int(slot)];
    vShade = pos.w;
    vSpeed = texture2D(tVelocity, reference).w;
    // The camera works in CSS pixels with y down the page, like the layout that places the slots.
    vec3 world = vec3(place.x + pos.x * place.z, -place.y + pos.y * place.z, pos.z * place.z);
    gl_Position = projectionMatrix * viewMatrix * vec4(world, 1.0);
    gl_PointSize = max(place.z * uPointScale, 1.0) * uPixelRatio;
  }
`

export const pointsFragmentShader = /* glsl */ `
  uniform vec3 uColorDark;
  uniform vec3 uColorLight;
  uniform vec3 uColorFast;
  uniform vec3 uLight;

  varying float vShade;
  varying float vSpeed;

  void main() {
    vec2 disc = gl_PointCoord * 2.0 - 1.0;
    float edge = dot(disc, disc);
    if (edge > 1.0) discard;
    // Each point is lit as a tiny sphere, which is what makes the surface read as beads.
    vec3 normal = vec3(disc.x, -disc.y, sqrt(1.0 - edge));
    // Lifted so the lit side reaches paper white instead of stopping at a grey midtone.
    float ramp = clamp(max(0.0, dot(uLight, normal)) * vShade * 1.5, 0.0, 1.0);
    vec3 color = mix(uColorDark, uColorLight, ramp);
    float fast = clamp((vSpeed - 0.003) / 0.002, 0.0, 1.0);
    color = mix(color, uColorFast, fast * fast);
    // Fast particles thin out: a cheap motion blur.
    float blur = clamp((0.007 - vSpeed) / 0.005, 0.0, 1.0);
    // Shaded in display space on purpose, with the palette passed as display values: the ramp is
    // a perceptual one, and converting it from linear would lift every midtone towards white.
    gl_FragColor = vec4(color, blur * blur * 0.5 + 0.5);  }
`
