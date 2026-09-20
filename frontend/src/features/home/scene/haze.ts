import {
  Vector3,
  type Camera,
  type IUniform,
  type Material,
  type WebGLProgramParametersWithUniforms,
} from 'three'
import type { Color } from 'three'
import { SUN_HAZE } from './palette'
import { patchShader } from './sceneShared'

// How fast the dust thins with height, per metre. It pools in the basin, so the feet of the
// massifs dissolve into it while their tops stand clear: that is what stacks them into layers.
export const HAZE_FALLOFF = 0.055

// three's fog fades everything to one colour by distance alone. Here the dust is thickest near
// the ground (the amount along each ray is worked out exactly for a density that falls off
// exponentially with height), and its colour leans toward the sun's glow the closer the view is
// to the sun, because dust lit from behind is far brighter than dust lit from the side.
// skyMaterial.ts paints its horizon with the same colour rule, so ground meets sky without a seam.
const HAZE_FRAGMENT = /* glsl */ `
#ifdef USE_FOG
  float hazeRise = vHazeWorld.y - cameraPosition.y;
  float hazeFrom = exp(-${HAZE_FALLOFF} * max(cameraPosition.y, 0.0));
  float hazeTo = exp(-${HAZE_FALLOFF} * max(vHazeWorld.y, 0.0));
  float hazeColumn = abs(hazeRise) > 0.05 ? (hazeFrom - hazeTo) / (${HAZE_FALLOFF} * hazeRise) : hazeFrom;
  // A thin share of the dust reaches every height, or a far summit above the pool would stand
  // as clear as a near one and lose its distance.
  float hazeAmount = 1.0 - exp(-fogDensity * vFogDepth * mix(hazeColumn, 1.0, 0.12));
  float sunward = max(dot(normalize(-vViewPosition), uSunView), 0.0);
  // Deliberately weaker than the sky's version of this rule. Matching it exactly lifted the
  // sunward massifs to nearly sky brightness and erased their silhouette; the reference keeps
  // a bright sky against darker rock, and that edge is what reads as distance rather than fog.
  vec3 hazeColor = mix(fogColor, uSunHaze, pow(sunward, 6.0) * 0.40 + pow(sunward, 1.5) * 0.07);

  gl_FragColor.rgb = mix(gl_FragColor.rgb, hazeColor, hazeAmount);
  // Aerial perspective is a loss of colour, and it depends on distance alone, not on how much of
  // the low dust the ray crossed: a summit 4 km off is washed out even standing clear of the pool.
  // Kept separate from hazeAmount for exactly that reason.
  // Squared falloff, not linear: the reference keeps its midground saturated and then loses
  // colour hard past about a kilometre. A plain exponential cannot make that corner.
  float aerialD = vFogDepth * 0.0015;
  float aerial = 1.0 - exp(-aerialD * aerialD);
  float aerialGrey = dot(gl_FragColor.rgb, vec3(0.2126, 0.7152, 0.0722));
  // Distance drains colour, a little less so toward the sun where dust forward-scatters. Only a
  // little: the reference's sunward massifs are desaturated AND dark, and it is the sky behind
  // them that carries the gold, not the rock itself.
  float aerialWarm = pow(sunward, 2.5);
  gl_FragColor.rgb = mix(
    gl_FragColor.rgb,
    vec3(aerialGrey) * vec3(0.92, 0.96, 1.11),
    aerial * 0.28 * (1.0 - aerialWarm * 0.30)
  );
#endif
`

const WORLD_POSITION = /* glsl */ `
#include <project_vertex>
#ifdef USE_INSTANCING
  vHazeWorld = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).xyz;
#else
  vHazeWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;
#endif
`

export type ShaderPatch = (shader: WebGLProgramParametersWithUniforms) => void

export interface Haze {
  /** extend runs on the same shader, for a material that needs its own changes as well. */
  apply: (material: Material, extend?: ShaderPatch) => void
  update: (camera: Camera) => void
}

export function createHaze(sun: Vector3): Haze {
  const sunView: IUniform<Vector3> = { value: new Vector3() }
  const sunHaze: IUniform<Color> = { value: SUN_HAZE }
  let patched = 0

  return {
    apply(material, extend) {
      material.onBeforeCompile = (shader) => {
        shader.uniforms.uSunView = sunView
        shader.uniforms.uSunHaze = sunHaze
        shader.vertexShader = patchShader(shader.vertexShader, [
          ['#include <common>', '#include <common>\nvarying vec3 vHazeWorld;'],
          ['#include <project_vertex>', WORLD_POSITION],
        ])
        shader.fragmentShader = patchShader(shader.fragmentShader, [
          [
            '#include <common>',
            '#include <common>\nvarying vec3 vHazeWorld;\nuniform vec3 uSunView;\nuniform vec3 uSunHaze;',
          ],
          ['#include <fog_fragment>', HAZE_FRAGMENT],
        ])
        extend?.(shader)
      }
      // three keys its compiled programs on the material's settings, not on what this callback
      // does to the source, so two materials patched differently must not look alike to it.
      const key = `haze:${extend ? ++patched : 0}`
      material.customProgramCacheKey = () => key
    },
    update(camera) {
      sunView.value.copy(sun).transformDirection(camera.matrixWorldInverse)
    },
  }
}
