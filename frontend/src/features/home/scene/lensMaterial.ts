import { ShaderMaterial, type IUniform } from 'three'
import { LIQUID_FIELD_GLSL } from '../../auth/liquid/liquidShader'

const VERTEX = /* glsl */ `
varying vec3 vNormal;
varying vec3 vToEye;

void main() {
  vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
  vNormal = normalize(normalMatrix * normal);
  vToEye = normalize(-viewPosition.xyz);
  gl_Position = projectionMatrix * viewPosition;
}
`

// The login's lens, now a real sphere: the same liquid seen through refracting glass, split per
// channel toward the rim, with the login's dispersion ring and bronze Fresnel edge. It is the
// scene's lamp, so it is pushed well past white and left to the tone mapper.
const FRAGMENT = /* glsl */ `
uniform float uTime;
uniform float uGain;
varying vec3 vNormal;
varying vec3 vToEye;

${LIQUID_FIELD_GLSL}

void main() {
  vec3 normal = normalize(vNormal);
  vec3 toEye = normalize(vToEye);
  float rim = 1.0 - max(dot(normal, toEye), 0.0);

  vec3 bent = refract(-toEye, normal, 1.0 / 1.45);
  vec2 base = bent.xy * 1.5 + vec2(3.1, 1.7);
  vec2 spread = normal.xy * rim * 0.5;
  vec3 color = vec3(
    liquid(base - spread, 0.75).r,
    liquid(base - spread * 0.88, 0.75).g,
    liquid(base - spread * 0.76, 0.75).b
  );

  float angle = atan(normal.y, normal.x);
  vec3 spectrum = 0.5 + 0.5 * cos(angle * 2.0 + uTime * 0.3 + vec3(0.0, 2.1, 4.2));
  float fresnel = pow(rim, 3.0);
  color = mix(color, spectrum * BRONZE_LIGHT, fresnel * 0.35);

  float breath = 0.9 + 0.1 * sin(uTime * 0.6);
  // Dark glass, as on the login: only the ribbons burn, so the channels between them stay black
  // and the lens reads as a vessel holding light rather than a lamp.
  float ribbon = smoothstep(0.22, 0.6, dot(color, vec3(0.3, 0.5, 0.2)));
  color = color * (0.5 + 1.7 * ribbon * breath) + BRONZE_LIGHT * fresnel * 0.9;

  vec3 lightDirection = normalize(vec3(-0.5, 0.6, 0.62));
  float specular = pow(max(dot(reflect(-lightDirection, normal), toEye), 0.0), 90.0);
  color += BRONZE_LIGHT * specular * 1.4;

  gl_FragColor = vec4(color * uGain, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`

export function createLensMaterial(time: IUniform<number>, gain: IUniform<number>): ShaderMaterial {
  return new ShaderMaterial({
    uniforms: { uTime: time, uGain: gain },
    vertexShader: VERTEX,
    fragmentShader: FRAGMENT,
  })
}
