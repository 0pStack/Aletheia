import {
  ACESFilmicToneMapping,
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Color,
  DirectionalLight,
  FogExp2,
  HalfFloatType,
  HemisphereLight,
  Material,
  Mesh,
  MeshStandardMaterial,
  NoColorSpace,
  PCFShadowMap,
  PerspectiveCamera,
  Points,
  Raycaster,
  RepeatWrapping,
  Scene,
  ShaderMaterial,
  SphereGeometry,
  TextureLoader,
  Vector2,
  Vector3,
  WebGLRenderer,
  WebGLRenderTarget,
  type IUniform,
  type Object3D,
  type Texture,
} from 'three'
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js'
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js'
import { createHaze } from './haze'
import { createIceBlock, LENS_WORLD_HEIGHT, type IceBlock } from './iceBlock'
import {
  DUST,
  EXPOSURE,
  FILL_STRENGTH,
  FOG_DENSITY,
  GROUND_BOUNCE,
  HAZE,
  NIGHTFALL,
  SKY_FILL,
  SUNLIGHT,
  SUN_STRENGTH,
} from './palette'
import { createProps, type Props } from './props'
import { patchShader } from './sceneShared'
import { createSkyMaterial } from './skyMaterial'

export interface LandingFrame {
  time: number
  pointerX: number
  pointerY: number
  /** Where the pointer really is, -1..1 across the canvas with +y up; null when there is none. */
  hover: { x: number; y: number } | null
  /** 0..1 of the first viewport scrolled away; carries the camera round the site. */
  scroll: number
  /**
   * 0 puts the camera at the lens inside the block, 1 at its resting viewpoint. The login dive
   * ends inside that same lens, so arriving at 0 and easing to 1 carries the eye out through the
   * ice without a cut. Defaults to 1: every ordinary visit begins already arrived.
   */
  arrival?: number
}

export interface LandingScene {
  resize: (width: number, height: number, pixelRatio: number) => void
  render: (frame: LandingFrame) => void
  dispose: () => void
}

export interface SceneTag {
  id: number
  /** Position in CSS pixels from the canvas's top-left corner. */
  x: number
  y: number
  strength: number
}

interface LandingSceneOptions {
  assetBase: string
  /** Called every frame with the ice pieces the pointer has pushed out, for the page to label. */
  onTags: (tags: readonly SceneTag[]) => void
  onReady: () => void
  onError: () => void
}

// Must match the Blender export: the detailed site is a square of this side, centred on the
// fallen block, set into a far coarser ground that runs out to the massifs.
const SITE_SIZE = 160
// Coarser than the mesh, so every cell is sure to hold at least one vertex.
const HEIGHT_CELLS = 150
// The ground beyond the site, read far more coarsely: it only has to seat distant rocks.
const FIELD_SIZE = 960
const FIELD_CELLS = 56
const BLOCK_CENTER = new Vector3(0, 1.6, 0)
const ARRIVAL_FROM = new Vector3()
const ARRIVAL_LOOK = new Vector3()

const START_ANGLE = -1.3
const LANDSCAPE_FOV = 28
const PORTRAIT_FOV = 40
const ORBIT_SWEEP = 0.56
const EYE_CLEARANCE = 2.5
const GRAIN_REPEAT = 130
const DUST_COUNT = 2200
// The motes wrap inside a box that travels with the camera, so there is dust wherever it looks.
const DUST_BOX = new Vector3(90, 26, 90)
// Low at the right of the first frame: near enough to be seen setting, far enough round that
// rocks and massifs show a lit flank instead of standing as flat silhouettes, and the type on
// the left sits over the dark side of the sky.
// Out at the right of the frame (24 deg off view centre), just clear of the ridge there, which
// measures 2.3 deg. Low and far right, as in the reference.
const SUN_DIRECTION = new Vector3(0.9987, 0.0488, -0.0174).normalize()
// The disc stays on the horizon at the right, where the reference puts it. The key light does not
// follow it: aimed from there we only ever see the shadow side of every cliff, which is what made
// the massifs read as sand. It comes from behind the camera instead, so the rock faces we can see
// are lit and their ledges cast across them. Physically these disagree; so does the reference.
const SUN_LIGHT_DIRECTION = new Vector3(-0.7364, 0.2756, -0.6179).normalize()

// The last touch, after tone mapping: the corners fall away so the eye stays in the middle of
// the frame, mid-tones get a little more bite, and a fine grain breaks up the banding that smooth
// haze gradients show on 8-bit screens.
const FINISH = {
  uniforms: { tDiffuse: { value: null }, uTime: { value: 0 } },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float uTime;
    varying vec2 vUv;
    void main() {
      vec3 color = texture2D(tDiffuse, vUv).rgb;
      color = mix(color, color * color * (3.0 - 2.0 * color), 0.22);
      vec2 fromCentre = (vUv - 0.5) * vec2(1.0, 0.85);
      color *= 1.0 - smoothstep(0.32, 0.95, length(fromCentre)) * ${0.42 + 0.13 * NIGHTFALL};
      float grain = fract(sin(dot(vUv * 1000.0 + fract(uTime) * 61.0, vec2(12.9898, 78.233))) * 43758.5453);
      color += (grain - 0.5) * 0.028;
      gl_FragColor = vec4(color, 1.0);
    }
  `,
}

const DUST_VERTEX = /* glsl */ `
uniform float uTime;
uniform float uScale;
uniform vec3 uBox;
uniform vec3 uCenter;
attribute float aSeed;
varying float vFade;
void main() {
  vec3 p = position;
  p.y = mod(p.y + sin(uTime * 0.15 + aSeed * 30.0) * 1.5, uBox.y);
  p.x += uTime * (0.9 + aSeed * 0.8);
  p.z += sin(uTime * 0.2 + aSeed * 50.0) * 1.2;
  p.xz = mod(p.xz - uCenter.xz, uBox.xz) - uBox.xz * 0.5 + uCenter.xz;
  vec4 viewPosition = modelViewMatrix * vec4(p, 1.0);
  float distance = -viewPosition.z;
  vFade = exp(-distance * 0.03) * smoothstep(0.5, 2.5, distance);
  gl_PointSize = max((0.02 + aSeed * aSeed * 0.05) * uScale / distance, 1.0);
  gl_Position = projectionMatrix * viewPosition;
}
`

const DUST_FRAGMENT = /* glsl */ `
uniform vec3 uColor;
varying float vFade;
void main() {
  float disc = smoothstep(0.5, 0.1, length(gl_PointCoord - 0.5));
  gl_FragColor = vec4(uColor * disc * vFade * 0.4, 1.0);
  #include <colorspace_fragment>
}
`

// The far ground's vertices are metres apart, far too coarse to carry a cliff's surface, so the
// rock is drawn in the shader wherever the ground is steep: bedding planes stacked by height and
// bent so they never run ruler-straight, finer beds inside them, and dark gullies cut downward.
const ROCK_NOISE = /* glsl */ `
float rockHash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

float rockNoise(vec2 x) {
  vec2 i = floor(x);
  vec2 f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(rockHash(i), rockHash(i + vec2(1.0, 0.0)), f.x),
    mix(rockHash(i + vec2(0.0, 1.0)), rockHash(i + vec2(1.0, 1.0)), f.x),
    f.y
  );
}
`

const ROCK_RELIEF = /* glsl */ `
#include <normal_fragment_maps>
// Tilt the surface along each bed so a ledge lights and shades like a real step. This is the
// relief the mesh cannot afford: at 115k triangles over 5 km there is no room for cliff faces.
vec3 rockUpView = normalize((viewMatrix * vec4(0.0, 1.0, 0.0, 0.0)).xyz);
vec3 rockTangentUp = rockUpView - normal * dot(normal, rockUpView);
if (length(rockTangentUp) > 0.001) {
  float rockLedge = cos(rockPhase) * 0.62 + cos(rockFinePhase) * 0.26;
  vec3 rockUp2 = normalize(rockTangentUp);
  vec3 rockSide = normalize(cross(normal, rockUp2));
  normal = normalize(normal + rockUp2 * rockLedge * rockSteep);
  // Crumple: sample the noise either side and push the normal along its slope. This is what makes
  // a face read as broken rock rather than a smooth shell with stripes drawn on it.
  vec2 rockP = vec2(vHazeWorld.x * 0.55 + vHazeWorld.z * 0.38, vHazeWorld.y * 0.55);
  float rockN = rockNoise(rockP);
  float rockDx = rockNoise(rockP + vec2(0.8, 0.0)) - rockN;
  float rockDy = rockNoise(rockP + vec2(0.0, 0.8)) - rockN;
  vec2 rockQ = rockP * 3.1;
  float rockM = rockNoise(rockQ);
  float rockEx = rockNoise(rockQ + vec2(0.8, 0.0)) - rockM;
  float rockEy = rockNoise(rockQ + vec2(0.0, 0.8)) - rockM;
  normal = normalize(normal + (rockSide * (rockDx * 1.30 + rockEx * 0.55)
                             + rockUp2  * (rockDy * 1.30 + rockEy * 0.55)) * rockSteep);
}
`

const ROCK_DETAIL = /* glsl */ `
#include <color_fragment>
vec3 rockNormal = inverseTransformDirection(normalize(vNormal), viewMatrix);
float rockSteep = smoothstep(0.99, 0.28, rockNormal.y);
float rockBend = rockNoise(vHazeWorld.xz * 0.008) * 4.2;
float rockPhase = vHazeWorld.y * 0.30 + rockBend;
float rockFinePhase = vHazeWorld.y * 1.45 + rockBend * 2.3;
float rockBeds = 0.5 + 0.5 * sin(rockPhase);
float rockFine = 0.5 + 0.5 * sin(rockFinePhase);
float rockGully = rockNoise(vec2((vHazeWorld.x + vHazeWorld.z) * 0.075, vHazeWorld.y * 0.022));
// Each course is its own stone rather than the same stone at another brightness: iron red, ochre
// and a pale marl cycling up the face. That change of colour between beds is the canyon read.
vec3 rockBand = mix(mix(vec3(0.66, 0.21, 0.07), vec3(0.90, 0.45, 0.14),
                        smoothstep(0.0, 0.45, fract(rockPhase / 6.2831853))),
                    vec3(0.88, 0.55, 0.26),
                    smoothstep(0.45, 1.0, fract(rockPhase / 6.2831853)));
float rockShade = (0.34 + 0.95 * rockBeds) * (0.66 + 0.58 * rockFine) * (0.76 + 0.34 * rockGully);
diffuseColor.rgb = mix(diffuseColor.rgb,
  mix(diffuseColor.rgb, rockBand * 1.30, 0.88) * rockShade, rockSteep);
// Edges turned toward the low sun catch it: a warm line along each skyline and buttress.
float rockRim = pow(1.0 - max(dot(normalize(vNormal), normalize(vViewPosition)), 0.0), 3.0);
diffuseColor.rgb += vec3(1.0, 0.64, 0.34) * rockRim * rockSteep * 0.58 * max(dot(normalize(-vViewPosition), uSunView) + 0.35, 0.0);
`

function mix(from: number, to: number, amount: number): number {
  return from + (to - from) * amount
}

// The exporter is free to reorder or duplicate vertices, so nothing is assumed about their
// layout: each one is binned into a coarse grid that keeps the highest point per cell, and the
// camera reads the ground under itself from that to stay above it.
function buildHeightLookup(
  geometry: BufferGeometry,
  size: number,
  cells: number,
): (x: number, z: number) => number {
  const position = geometry.getAttribute('position')
  const heights = new Float32Array(cells * cells).fill(-Infinity)
  const toCell = (value: number) =>
    Math.min(Math.max(Math.floor((value / size + 0.5) * cells), 0), cells - 1)
  for (let i = 0; i < position.count; i++) {
    if (Math.max(Math.abs(position.getX(i)), Math.abs(position.getZ(i))) > size / 2) continue
    const cell = toCell(position.getZ(i)) * cells + toCell(position.getX(i))
    heights[cell] = Math.max(heights[cell] ?? -Infinity, position.getY(i))
  }
  return (x, z) => {
    const height = heights[toCell(z) * cells + toCell(x)] ?? 0
    return Number.isFinite(height) ? height : 0
  }
}

// Frees everything a loaded file brought with it except the geometries the scene keeps.
function releaseLoaded(root: Object3D, kept: readonly BufferGeometry[]) {
  root.traverse((node) => {
    if (!(node instanceof Mesh)) return
    if (node.geometry instanceof BufferGeometry && !kept.includes(node.geometry)) {
      node.geometry.dispose()
    }
    const materials: unknown[] = Array.isArray(node.material) ? node.material : [node.material]
    for (const material of materials) if (material instanceof Material) material.dispose()
  })
}

function createDust(
  time: IUniform<number>,
  scale: IUniform<number>,
  center: IUniform<Vector3>,
): Points<BufferGeometry, ShaderMaterial> {
  const positions = new Float32Array(DUST_COUNT * 3)
  const seeds = new Float32Array(DUST_COUNT)
  for (let i = 0; i < DUST_COUNT; i++) {
    positions[i * 3] = Math.random() * DUST_BOX.x
    positions[i * 3 + 1] = Math.random() * DUST_BOX.y
    positions[i * 3 + 2] = Math.random() * DUST_BOX.z
    seeds[i] = Math.random()
  }
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new BufferAttribute(positions, 3))
  geometry.setAttribute('aSeed', new BufferAttribute(seeds, 1))
  const material = new ShaderMaterial({
    uniforms: {
      uTime: time,
      uScale: scale,
      uBox: { value: DUST_BOX },
      uCenter: center,
      uColor: { value: new Color(DUST) },
    },
    vertexShader: DUST_VERTEX,
    fragmentShader: DUST_FRAGMENT,
    blending: AdditiveBlending,
    depthWrite: false,
    transparent: true,
  })
  const dust = new Points(geometry, material)
  // The motes wrap inside the shader, so their real bounds never match the buffer's.
  dust.frustumCulled = false
  return dust
}

function loadDataTexture(loader: TextureLoader, url: string): Promise<Texture> {
  return loader.loadAsync(url).then((texture) => {
    texture.colorSpace = NoColorSpace
    // glTF UVs run top-down, and the maps were written to match.
    texture.flipY = false
    return texture
  })
}

export function createLandingScene(
  canvas: HTMLCanvasElement,
  { assetBase, onTags, onReady, onError }: LandingSceneOptions,
): LandingScene | null {
  let renderer: WebGLRenderer
  try {
    renderer = new WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' })
  } catch {
    return null
  }
  renderer.toneMapping = ACESFilmicToneMapping
  renderer.toneMappingExposure = EXPOSURE
  // The ice refracts a second rendering of the scene; at half size it costs a quarter as much,
  // and the frost blurs it anyway.
  renderer.transmissionResolutionScale = 0.5
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = PCFShadowMap

  // Rendered off screen first so the brightest parts (the sun, the lit dust, the glints on the
  // ice) can bleed light; the last pass applies the tone mapping the renderer is set to.
  const frame = new WebGLRenderTarget(1, 1, { type: HalfFloatType, samples: 4 })
  const composer = new EffectComposer(renderer, frame)

  const scene = new Scene()
  scene.fog = new FogExp2(HAZE, FOG_DENSITY)
  const camera = new PerspectiveCamera(LANDSCAPE_FOV, 1, 0.1, 5000)
  const haze = createHaze(SUN_DIRECTION)
  const bloom = new UnrealBloomPass(new Vector2(1, 1), 0.12, 0.4, 0.92)
  composer.addPass(new RenderPass(scene, camera))
  composer.addPass(bloom)
  composer.addPass(new OutputPass())
  const finish = new ShaderPass(FINISH)
  composer.addPass(finish)

  const sun = new DirectionalLight(SUNLIGHT, SUN_STRENGTH)
  sun.position.copy(SUN_LIGHT_DIRECTION).multiplyScalar(160)
  sun.castShadow = true
  sun.shadow.mapSize.set(2048, 2048)
  sun.shadow.camera.left = -70
  sun.shadow.camera.right = 70
  sun.shadow.camera.top = 70
  sun.shadow.camera.bottom = -70
  sun.shadow.camera.near = 1
  sun.shadow.camera.far = 340
  sun.shadow.bias = -0.0008
  sun.shadow.normalBias = 0.12
  scene.add(sun, new HemisphereLight(SKY_FILL, GROUND_BOUNCE, FILL_STRENGTH))

  // One clock drives the clouds and the dust.
  const clock: IUniform<number> = { value: 0 }
  const dustScale: IUniform<number> = { value: 1 }
  const dustCenter: IUniform<Vector3> = { value: new Vector3() }

  const sky = new Mesh(new SphereGeometry(4000, 48, 24), createSkyMaterial(SUN_DIRECTION, clock))
  const dust = createDust(clock, dustScale, dustCenter)
  scene.add(sky, dust)

  // Sand and rock colours are painted per vertex in Blender, so one material covers both.
  const siteMaterial = new MeshStandardMaterial({ vertexColors: true, roughness: 0.96 })
  const groundMaterial = new MeshStandardMaterial({ vertexColors: true, roughness: 1 })
  haze.apply(siteMaterial)
  haze.apply(groundMaterial, (shader) => {
    shader.fragmentShader = patchShader(shader.fragmentShader, [
      ['#include <common>', `#include <common>\n${ROCK_NOISE}`],
      ['#include <color_fragment>', ROCK_DETAIL],
      ['#include <normal_fragment_maps>', ROCK_RELIEF],
    ])
  })
  let site: Mesh<BufferGeometry, MeshStandardMaterial> | null = null
  let ground: Mesh<BufferGeometry, MeshStandardMaterial> | null = null
  let props: Props | null = null
  let iceBlock: IceBlock | null = null
  let groundAt: (x: number, z: number) => number = () => 0
  let disposed = false
  let aspect = 1

  const draco = new DRACOLoader().setDecoderPath(`${assetBase}draco/`)
  const textures = new TextureLoader()
  const models = new GLTFLoader().setDRACOLoader(draco)
  // Settled, not all: if one file fails, the ones that did arrive still have to be freed.
  Promise.allSettled([
    models.loadAsync(`${assetBase}landing/terrain.glb`),
    models.loadAsync(`${assetBase}landing/props.glb`),
    models.loadAsync(`${assetBase}landing/block.glb`),
    loadDataTexture(textures, `${assetBase}landing/terrain-ao.jpg`),
    loadDataTexture(textures, `${assetBase}landing/snow-grain.jpg`),
  ])
    .then((results) => {
      const [terrainFile, propsFile, blockFile, occlusionFile, grainFile] = results
      const failure = results.find((result) => result.status === 'rejected')
      // The page can leave (and StrictMode always remounts) before the files arrive.
      if (
        disposed ||
        failure ||
        terrainFile.status !== 'fulfilled' ||
        propsFile.status !== 'fulfilled' ||
        blockFile.status !== 'fulfilled' ||
        occlusionFile.status !== 'fulfilled' ||
        grainFile.status !== 'fulfilled'
      ) {
        for (const file of [terrainFile, propsFile, blockFile]) {
          if (file.status === 'fulfilled') releaseLoaded(file.value.scene, [])
        }
        for (const file of [occlusionFile, grainFile]) {
          if (file.status === 'fulfilled') file.value.dispose()
        }
        if (failure) throw failure.reason
        return
      }
      const gltf = terrainFile.value
      const propModels = propsFile.value
      const blockModels = blockFile.value
      const occlusion = occlusionFile.value
      const grain = grainFile.value
      const near = gltf.scene.getObjectByName('Terrain')
      const far = gltf.scene.getObjectByName('Backdrop')
      if (!(near instanceof Mesh) || !(far instanceof Mesh)) {
        throw new Error('terrain.glb is missing the Terrain or Backdrop mesh')
      }

      // The mesh carries the form in full-precision normals (an 8-bit normal map bands into
      // contour lines on ground this smooth); a small tiled bump adds the wind ripple up close.
      grain.wrapS = RepeatWrapping
      grain.wrapT = RepeatWrapping
      grain.repeat.set(GRAIN_REPEAT, GRAIN_REPEAT)
      siteMaterial.bumpMap = grain
      siteMaterial.bumpScale = 1.2
      // Occlusion darkens direct light too (as the albedo) so hollows stay dark under the sun.
      siteMaterial.map = occlusion
      siteMaterial.aoMap = occlusion
      siteMaterial.needsUpdate = true

      site = new Mesh(near.geometry, siteMaterial)
      site.castShadow = true
      site.receiveShadow = true
      groundAt = buildHeightLookup(site.geometry, SITE_SIZE, HEIGHT_CELLS)
      ground = new Mesh(far.geometry, groundMaterial)
      const siteGround = groundAt
      const fieldGround = buildHeightLookup(far.geometry, FIELD_SIZE, FIELD_CELLS)
      const anyGround = (x: number, z: number) =>
        Math.max(Math.abs(x), Math.abs(z)) < SITE_SIZE / 2 ? siteGround(x, z) : fieldGround(x, z)
      props = createProps(propModels.scene, anyGround, haze)
      releaseLoaded(gltf.scene, [near.geometry, far.geometry])
      iceBlock = createIceBlock(blockModels.scene, anyGround, haze)
      releaseLoaded(propModels.scene, props.geometries)
      releaseLoaded(blockModels.scene, iceBlock.geometries)
      scene.add(site, ground, ...props.objects, ...iceBlock.objects)
      onReady()
    })
    .catch((error: unknown) => {
      console.error('Landing scene assets failed to load:', error)
      if (!disposed) onError()
    })

  const target = new Vector3()
  const raycaster = new Raycaster()
  const pointerRay = new Vector2()
  const projected = new Vector3()
  const sceneTags: SceneTag[] = []
  let viewWidth = 1
  let viewHeight = 1

  return {
    resize(width, height, pixelRatio) {
      renderer.setPixelRatio(pixelRatio)
      renderer.setSize(width, height, false)
      composer.setPixelRatio(pixelRatio)
      composer.setSize(width, height)
      aspect = width / Math.max(height, 1)
      viewWidth = width
      viewHeight = height
      camera.aspect = aspect
      // A tall screen sees a narrow slice; a wider lens brings the massifs back into it.
      camera.fov = aspect < 1 ? PORTRAIT_FOV : LANDSCAPE_FOV
      camera.updateProjectionMatrix()
      dustScale.value = height * pixelRatio
    },
    render({ time, pointerX, pointerY, hover, scroll, arrival = 1 }) {
      const angle = START_ANGLE + scroll * ORBIT_SWEEP + pointerX * 0.1 + time * 0.004
      // Tall screens stand further back and higher: the block still fits, and the rocks at the
      // camera's feet shrink instead of walling off the bottom of the frame.
      const portrait = aspect < 1
      const radius = mix(90, 78, scroll) * (portrait ? 1.3 : 1)
      const x = Math.sin(angle) * radius
      const z = Math.cos(angle) * radius
      const height = mix(10, 17, scroll) + (portrait ? 8 : 0) - pointerY * 1.4
      camera.position.set(x, Math.max(height, groundAt(x, z) + EYE_CLEARANCE), z)

      // The type sits on the left, so the view is aimed left of the block to seat it on the right.
      const aside = aspect > 1.2 ? mix(15, 9, scroll) : 0
      target.set(
        BLOCK_CENTER.x - Math.cos(angle) * aside,
        // Aiming lower as the glass section rises keeps the block in the part still showing.
        BLOCK_CENTER.y + (portrait ? mix(5, -4, scroll) : mix(7.5, -1.5, scroll)),
        BLOCK_CENTER.z + Math.sin(angle) * aside,
      )
      if (arrival < 1) {
        // Withdraw from the lens frozen in the block out to the resting viewpoint. The lens sits
        // on the block's axis, so the start is simply above the origin; easing the whole path
        // rather than the angle keeps the block centred the entire way out.
        const lensY = groundAt(0, 0) + LENS_WORLD_HEIGHT
        camera.position.lerp(ARRIVAL_FROM.set(0, lensY, 0), 1 - arrival)
        target.lerp(ARRIVAL_LOOK.set(0, lensY, -1), (1 - arrival) * 0.85)
      }
      camera.lookAt(target)
      camera.updateMatrixWorld()

      clock.value = time
      const grainTime = finish.uniforms.uTime
      if (grainTime) grainTime.value = time
      if (iceBlock) {
        let touch: Vector3 | null = null
        if (hover) {
          raycaster.setFromCamera(pointerRay.set(hover.x, hover.y), camera)
          touch = raycaster.intersectObject(iceBlock.hitTarget, true)[0]?.point ?? null
        }
        iceBlock.update(time, touch, 1 - arrival)
        sceneTags.length = 0
        for (const tag of iceBlock.tags()) {
          projected.copy(tag.position).project(camera)
          sceneTags.push({
            id: tag.id,
            x: (projected.x * 0.5 + 0.5) * viewWidth,
            y: (0.5 - projected.y * 0.5) * viewHeight,
            strength: tag.strength,
          })
        }
        onTags(sceneTags)
      }
      dustCenter.value.copy(camera.position)
      haze.update(camera)
      composer.render()
    },
    dispose() {
      disposed = true
      site?.geometry.dispose()
      ground?.geometry.dispose()
      siteMaterial.bumpMap?.dispose()
      siteMaterial.map?.dispose()
      siteMaterial.dispose()
      groundMaterial.dispose()
      props?.dispose()
      iceBlock?.dispose()
      for (const mesh of [sky, dust]) {
        mesh.geometry.dispose()
        mesh.material.dispose()
      }
      sun.shadow.map?.dispose()
      bloom.dispose()
      finish.dispose()
      composer.dispose()
      frame.dispose()
      draco.dispose()
      // Not forcing context loss: React StrictMode remounts onto the same canvas element, and a
      // lost context cannot be recovered for it.
      renderer.dispose()
    },
  }
}
