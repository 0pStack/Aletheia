import { BackSide, ShaderMaterial, type IUniform, type Vector3 } from 'three'
import { HAZE, NIGHTFALL, SUN_HAZE, ZENITH } from './palette'

const VERTEX = /* glsl */ `
varying vec3 vDirection;
void main() {
  vDirection = normalize(position);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`

// Last light: the sun sits low, so the haze band around it is the brightest thing in the frame
// and the sky falls away to near-black overhead. The horizon uses the same colour rule
// as the ground haze (see haze.ts), so far ground dissolves into sky without a seam. The cloud
// deck is a flat layer seen in perspective, lit from underneath on the sun's side.
const FRAGMENT = /* glsl */ `
uniform vec3 uHaze;
uniform vec3 uSunHaze;
uniform vec3 uZenith;
uniform vec3 uSun;
uniform float uTime;
uniform float uNightfall;
varying vec3 vDirection;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

float noise(vec2 x) {
  vec2 i = floor(x);
  vec2 f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
    mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x),
    f.y
  );
}

float fbm(vec2 p) {
  float value = 0.0;
  float amplitude = 0.5;
  for (int i = 0; i < 5; i++) {
    value += amplitude * noise(p);
    p = mat2(1.6, 1.2, -1.2, 1.6) * p;
    amplitude *= 0.5;
  }
  return value;
}

void main() {
  vec3 direction = normalize(vDirection);
  float sunward = max(dot(direction, uSun), 0.0);
  // The same rule haze.ts fades the ground to, so the two meet without a seam.
  float toward = pow(sunward, 6.0) * 0.7 + pow(sunward, 1.5) * 0.16;
  float up = max(direction.y, 0.0);

  vec3 horizon = mix(uHaze, uSunHaze, toward);
  // As the sun goes down the warm is squeezed into a band just above the horizon and the rest of
  // the sky falls away to the zenith much sooner.
  float reach = mix(0.45, 0.16, uNightfall);
  vec3 upper = mix(mix(uHaze * 0.42, uSunHaze * 0.3, toward), uZenith, smoothstep(0.02, reach, up));
  vec3 color = mix(horizon, upper, smoothstep(0.0, mix(0.2, 0.07, uNightfall), up));
  // The band of lit dust lying along the horizon, several stops hotter toward the sun, then the
  // sun's own glow and its disc. These run well past white and are left to the tone mapper.
  float band = pow(1.0 - min(abs(direction.y) * 6.5, 1.0), 3.0);
  color += uSunHaze * band * (0.06 + 0.54 * pow(sunward, 4.5));
  color += uSunHaze * (pow(sunward, 70.0) * 0.20 + pow(sunward, 900.0) * 1.3);
  color += vec3(1.0, 0.86, 0.62) * smoothstep(0.9999280, 0.9999776, sunward) * 7.0;

  if (direction.y > 0.01) {
    // High, thin streaks, drawn out along the wind.
    vec2 high = direction.xz / (direction.y + 0.22) * vec2(0.2, 1.2) + uTime * vec2(0.002, 0.0006);
    float cirrus = smoothstep(0.52, 0.8, fbm(high * 2.4)) * smoothstep(0.1, 0.32, direction.y);
    color = mix(color, mix(uHaze * 0.7, uSunHaze * 0.85, pow(sunward, 2.0)), cirrus * 0.3);

    // A lower deck of separate banks. The field is pushed around by a slower copy of itself,
    // which curls the banks into billows instead of leaving them as round smears, and a finer
    // layer breaks up their edges.
    vec2 low = direction.xz / (direction.y + 0.12) * vec2(0.6, 1.0) + uTime * vec2(0.005, 0.0012);
    vec2 curl = vec2(fbm(low * 0.7 + 3.1), fbm(low * 0.7 + 8.4)) - 0.5;
    vec2 billow = low * 1.35 + curl * 1.5;
    float density = fbm(billow) + (fbm(billow * 3.6 + 1.7) - 0.5) * 0.22;
    float cover = smoothstep(0.58, 0.74, density);
    // Thin at the rim of a bank, thick in its middle: the low sun soaks through the rim and is
    // lost in the middle, so each bank gets a bright lining and a dark heart.
    float thickness = smoothstep(0.5, 0.78, density);
    float facing = pow(sunward, 1.6);
    vec3 heart = mix(vec3(0.17, 0.15, 0.19), uHaze * 0.6, 0.45 + 0.4 * facing);
    vec3 lining = mix(vec3(0.5, 0.4, 0.4), uSunHaze * 1.25, facing);
    vec3 cloud = mix(lining, heart, thickness);
    color = mix(color, cloud, cover * smoothstep(0.02, 0.18, direction.y) * 0.72);
  }

  gl_FragColor = vec4(color, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`

export function createSkyMaterial(sun: Vector3, time: IUniform<number>): ShaderMaterial {
  return new ShaderMaterial({
    uniforms: {
      uHaze: { value: HAZE },
      uSunHaze: { value: SUN_HAZE },
      uZenith: { value: ZENITH },
      uSun: { value: sun },
      uTime: time,
      uNightfall: { value: NIGHTFALL },
    },
    vertexShader: VERTEX,
    fragmentShader: FRAGMENT,
    side: BackSide,
    depthWrite: false,
    fog: false,
  })
}
