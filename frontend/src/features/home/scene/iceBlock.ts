import {
  BufferGeometry,
  Color,
  Euler,
  Group,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshPhysicalMaterial,
  PointLight,
  Quaternion,
  ShaderChunk,
  SphereGeometry,
  Vector3,
  type IUniform,
  type Object3D,
} from 'three'
import type { Haze } from './haze'
import { createLensMaterial } from './lensMaterial'
import { findGeometry, GOUGE, patchShader } from './sceneShared'

export interface IceTag {
  id: number
  /** World position of the lifted piece. */
  position: Vector3
  /** 0..1, how far out the piece has come. */
  strength: number
}

export interface IceBlock {
  /** What the pointer has to be over for the block to count as touched. */
  hitTarget: Object3D
  /** The pieces currently pushed out, for the scene to label. */
  tags: () => readonly IceTag[]
  objects: readonly Object3D[]
  geometries: readonly BufferGeometry[]
  /**
   * touch is where the pointer's ray meets the block, in world space, or null. openBias holds the
   * pieces apart regardless of the pointer: the arrival uses it so the shell seals behind the eye
   * as it withdraws.
   */
  update: (time: number, touch: Vector3 | null, openBias?: number) => void
  dispose: () => void
}

const SHARD_NAMES = ['IceShardA', 'IceShardB', 'IceShardC'] as const
const ICE_GLOW = '#5fd0e6'
// The block is modelled about 3.7 m across and the camera stands 90 m off, so it has to be scaled
// up hard to own the frame. BLOCK_HALF is its own model half-height, used to seat it.
const BLOCK_SCALE = 5
const BLOCK_HALF = 1.15
// How much of it the sand has taken.
const BLOCK_BURY = 0.18
// The pieces are an exact Voronoi break of the block, so they tile it with no gaps. They are
// still grown a hair about their own centres, only enough to keep coincident shared faces from
// z-fighting where two pieces meet.
const CELL_INFLATE = 1.006
// The lens the login dives through, locked in the hollow at the middle of the block.
const LENS_HEIGHT = 1.4
const LENS_RADIUS = 2.3
const LENS_DRIFT = 0.12
// Where the lens ends up above the ground, derived rather than copied: the arrival camera in
// createLandingScene.ts starts here, and hand-carrying the number let it drift to 6.1.
export const LENS_WORLD_HEIGHT = BLOCK_HALF * BLOCK_SCALE * (1 - BLOCK_BURY) + LENS_HEIGHT
// Under the pointer the block comes free of the sand and hangs a little above its crater, as if
// something had taken its weight. It rises quicker than it settles, and sways while it is up.
// Rates are slow on purpose: the block moves as if under the moon's gravity, lifting lazily and
// taking its time to settle back into the sand.
const HOVER_LIFT = 3.4
const HOVER_RISE_RATE = 1.2
const HOVER_SETTLE_RATE = 0.7
const HOVER_SWAY = 0.18
const SWAY_SPEED = 0.45
// The block is a skin of pieces round a hollow that holds the lens. Pieces near the pointer push
// outward, as the igloo's blocks do, opening a gap onto the light inside.
const CELL_PREFIX = 'IceCell'
// How far from the pointer a piece still feels it, and how far and how much it turns when it does.
// Measured against the block, not in metres, so the feel survives any change of scale.
const CELL_REACH = BLOCK_HALF * BLOCK_SCALE * 1.6
const CELL_TRAVEL = 0.9
const CELL_TURN_MIN = 0.17
const CELL_TURN_RANGE = 0.45
// Each piece rides a soft spring, so it floats out and back slowly, as things drift in low gravity.
// Just under critical damping: it glides into place with no swing back, which is what keeps a
// held pointer calm instead of setting the pieces churning.
const CELL_STIFFNESS = 12
const CELL_DAMPING = 2 * Math.sqrt(CELL_STIFFNESS) * 0.95
// The pieces answer a point that glides after the pointer, not the pointer itself, and the
// pointer's presence fades in and out rather than switching: no jumps as it crosses the block.
const FOCUS_RATE = 4
const PRESENCE_RISE_RATE = 2.2
const PRESENCE_FALL_RATE = 1.1
// At rest the block breathes in a cycle of three phases: a small breath, a deep one that opens the
// block wide, then a calm in which it rests shut. A wave passes through the pieces in turn, and
// the light inside follows the same rhythm. The anchor pieces breathe less, so the outline holds
// even at the top of the deep breath.
const BREATH_TRAVEL = 0.28
const BREATH_CYCLE_S = 11
const SMALL_BREATH_END = 0.28
const DEEP_BREATH_END = 0.72
// The small breath is the block's original, barely-there breath: 0.035 of travel.
const SMALL_BREATH_SIZE = 0.035 / BREATH_TRAVEL
// How far behind the first piece the last one breathes, as a share of the cycle.
const BREATH_WAVE = 0.006
const BREATH_TURN = 0.35
const BREATH_ANCHOR = 0.35
// How much of the inner light the seams catch at the top of a breath (1 is fully opened).
const BREATH_GLOW = 0.35
const TAG_THRESHOLD = 0.25

// 0..1 through the three-phase breath at a point in its cycle. sin² bumps start and end with zero
// speed, so the block never jerks between phases.
function breathAt(cycle: number): number {
  const t = cycle - Math.floor(cycle)
  const bump = (from: number, to: number) => Math.sin((Math.PI * (t - from)) / (to - from)) ** 2
  if (t < SMALL_BREATH_END) return SMALL_BREATH_SIZE * bump(0, SMALL_BREATH_END)
  if (t < DEEP_BREATH_END) return bump(SMALL_BREATH_END, DEEP_BREATH_END)
  return 0
}
// The shards it shed lie along the gouge: distance along it, and to its side.
const SHARDS = [
  { along: 9, across: 3.4, size: 1.6 },
  { along: 11, across: -3.6, size: 1.1 },
  { along: 14, across: 0.8, size: 2 },
  { along: 18, across: -2.2, size: 0.9 },
  { along: 22, across: 3.1, size: 1.3 },
  { along: 26, across: -0.6, size: 0.7 },
  { along: 31, across: 1.7, size: 1.2 },
  { along: 37, across: -2.8, size: 0.8 },
  { along: 43, across: 0.9, size: 0.6 },
  { along: -8, across: 3.6, size: 1.2 },
  { along: -7, across: -5, size: 0.85 },
  { along: 2, across: 8.5, size: 0.7 },
] as const

const NOISE = /* glsl */ `
float iceHash(vec3 p) {
  p = fract(p * 0.3183099 + 0.1);
  p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}

float iceNoise(vec3 x) {
  vec3 i = floor(x);
  vec3 f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(mix(iceHash(i), iceHash(i + vec3(1, 0, 0)), f.x), mix(iceHash(i + vec3(0, 1, 0)), iceHash(i + vec3(1, 1, 0)), f.x), f.y),
    mix(mix(iceHash(i + vec3(0, 0, 1)), iceHash(i + vec3(1, 0, 1)), f.x), mix(iceHash(i + vec3(0, 1, 1)), iceHash(i + vec3(1, 1, 1)), f.x), f.y),
    f.z
  );
}

float iceFbm(vec3 p) {
  float value = 0.0;
  float amplitude = 0.5;
  for (int i = 0; i < 4; i++) {
    value += amplitude * iceNoise(p);
    p = p * 2.07 + vec3(1.7, 9.2, 3.1);
    amplitude *= 0.5;
  }
  return value;
}
`

// Clear ice is only half the reference: the rest is white veins running one way through it, as
// if along old fractures, and cloudy patches where the surface has frosted. Both are worked out
// in the block's own space, so they stay put on it; where they fall, the ice turns white and
// rough and lets less of the scene through.
const FROST = /* glsl */ `
#include <color_fragment>
vec3 icePoint = vIcePosition * 1.5;
float iceStreak = iceFbm(vec3(icePoint.x * 0.7 + icePoint.y * 2.4, icePoint.y * 0.5 - icePoint.x * 1.1, icePoint.z * 0.8));
// Folding the noise turns soft bands into thin bright lines: veins rather than smears.
float iceVein = pow(1.0 - abs(2.0 * iceStreak - 1.0), 3.0);
float iceCloud = smoothstep(0.32, 0.68, iceFbm(icePoint * 0.8 + 7.0));
// The middle of each big cleaved face is left clear, a window onto the lens inside.
float iceWindow = smoothstep(1.0, 1.4, length(vIcePosition));
float iceFrost = clamp(iceVein * 0.95 + iceCloud * 0.6, 0.0, 1.0) * mix(0.35, 1.0, iceWindow);
diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.84, 0.9, 0.92), iceFrost);
`

// three reads how much light passes straight from a uniform inside its own chunk, so the chunk
// is inlined with that one line scaled by the frost.
const FROSTED_TRANSMISSION = patchShader(ShaderChunk.transmission_fragment, [
  [
    'material.transmission = transmission;',
    'material.transmission = transmission * (1.0 - iceFrost * 0.8);',
  ],
])
const MODEL_FILE = 'block.glb'

export function createIceBlock(
  root: Object3D,
  groundAt: (x: number, z: number) => number,
  haze: Haze,
): IceBlock {
  const source = root.getObjectByName('IceBlock')
  if (!source) throw new Error('block.glb is missing the IceBlock mesh')
  const shardGeometries = SHARD_NAMES.map((name) => findGeometry(root, name, MODEL_FILE))

  const pulse: IUniform<number> = { value: 0 }
  const glow: IUniform<Color> = { value: new Color(ICE_GLOW) }
  const lensClock: IUniform<number> = { value: 0 }
  const lensGain: IUniform<number> = { value: 0.4 }
  const opened: IUniform<number> = { value: 0 }

  const ice = new MeshPhysicalMaterial({
    color: '#9fd3de',
    roughness: 0.24,
    transmission: 0.95,
    thickness: 3.0,
    ior: 1.31,
    // Light loses its warm end on the way through, so the depths go cyan while thin edges and the
    // frosted skin stay white.
    attenuationColor: '#2f9cc0',
    attenuationDistance: 15.0,
  })
  haze.apply(ice, (shader) => {
    shader.uniforms.uIcePulse = pulse
    shader.uniforms.uIceGlow = glow
    shader.uniforms.uIceOpen = opened
    shader.vertexShader = patchShader(shader.vertexShader, [
      [
        '#include <common>',
        '#include <common>\nvarying vec3 vIcePosition;\nvarying vec3 vIceNormal;',
      ],
      [
        '#include <begin_vertex>',
        '#include <begin_vertex>\nvIcePosition = position;\nvIceNormal = normal;',
      ],
    ])
    shader.fragmentShader = patchShader(shader.fragmentShader, [
      [
        '#include <common>',
        `#include <common>\nvarying vec3 vIcePosition;\nvarying vec3 vIceNormal;\nuniform float uIcePulse;\nuniform float uIceOpen;\nuniform vec3 uIceGlow;\n${NOISE}`,
      ],
      ['#include <color_fragment>', FROST],
      [
        '#include <roughnessmap_fragment>',
        '#include <roughnessmap_fragment>\nroughnessFactor = mix(roughnessFactor, 0.8, iceFrost);',
      ],
      // Ice scatters light through itself, so even its shaded side keeps a pale body; over that
      // runs the slow breath of light from inside, strongest where cloudy ice can catch it. Faces
      // that look in on the hollow are lit by the lens directly: closed, that shows only as light
      // in the seams; opened, the pieces' inner sides go white, as the igloo's do.
      [
        '#include <emissivemap_fragment>',
        '#include <emissivemap_fragment>\ntotalEmissiveRadiance += uIceGlow * (0.05 + 0.035 * iceFrost + uIcePulse * (0.02 + 0.08 * iceCloud));\nfloat iceInner = smoothstep(0.15, 0.7, dot(normalize(vIceNormal), -normalize(vIcePosition)));\ntotalEmissiveRadiance += mix(uIceGlow, vec3(1.0), 0.4) * iceInner * (0.50 + 0.45 * uIcePulse + 1.1 * uIceOpen);',
      ],
      ['#include <transmission_fragment>', FROSTED_TRANSMISSION],
    ])
  })

  // The pieces are an exact Voronoi break of the block, so they tile it with no gaps and there is
  // nothing to plug: the shrunken copy that used to sit inside doing that job is gone.
  const shell = new Group()
  // Seated on the crater floor as the ground actually is, not where the model happened to sit.
  shell.position.set(0, groundAt(0, 0) + BLOCK_HALF * BLOCK_SCALE * (1 - BLOCK_BURY), 0)
  shell.quaternion.copy(source.quaternion)
  shell.scale.setScalar(BLOCK_SCALE)

  const cellGeometries: BufferGeometry[] = []
  root.traverse((node) => {
    if (
      node instanceof Mesh &&
      node.name.startsWith(CELL_PREFIX) &&
      node.geometry instanceof BufferGeometry
    ) {
      cellGeometries.push(node.geometry)
    }
  })
  if (cellGeometries.length === 0) throw new Error(`${MODEL_FILE} holds no ${CELL_PREFIX} meshes`)
  const cells = cellGeometries.map((geometry, index) => {
    geometry.computeBoundingBox()
    const centre = geometry.boundingBox?.getCenter(new Vector3()) ?? new Vector3()
    const mesh = new Mesh(geometry, ice)
    mesh.scale.setScalar(CELL_INFLATE)
    mesh.castShadow = true
    shell.add(mesh)
    return {
      id: index + 1,
      mesh,
      centre,
      outward: centre.clone().normalize(),
      // Each piece tumbles its own way as it comes out.
      axis: new Vector3(
        Math.sin(index * 2.4),
        Math.cos(index * 1.7),
        Math.sin(index * 0.9),
      ).normalize(),
      world: new Vector3(),
      // Farther pieces answer later, so a touch ripples outward through the block.
      phase: centre.length() * 1.9 + index * 0.37,
      // Half the pieces barely leave home, so the block's outline survives while it opens.
      mobility: index % 2 === 0 ? 1 : 0.45,
      turn: CELL_TURN_MIN + ((index * 7) % 5) * (CELL_TURN_RANGE / 4),
      // They do not all go at once: the opening runs through the block.
      delay: ((index * 3) % 4) * 0.05,
      wait: 0,
      push: 0,
      speed: 0,
    }
  })

  const lens = new Mesh(
    new SphereGeometry(LENS_RADIUS, 48, 32),
    createLensMaterial(lensClock, lensGain),
  )
  lens.position.copy(shell.position).setY(shell.position.y + LENS_HEIGHT)

  const lamp = new PointLight(ICE_GLOW, 0, 34, 2)
  lamp.position.copy(lens.position).setY(lens.position.y + 0.8)

  // The pointer is tested against a still volume, never the moving block. Hit-testing the pieces
  // let a pushed piece move the hit point, which moved the pieces; hit-testing anything that rises
  // with the block let the lift carry it out from under a still pointer, so it sank, was caught
  // again and rose, over and over. This one stays put and is stretched upward to cover the block
  // both resting and lifted.
  const hitRadius = BLOCK_HALF * BLOCK_SCALE
  const hitProxy = new Mesh(
    new SphereGeometry(hitRadius, 16, 12),
    new MeshBasicMaterial({ visible: false }),
  )
  hitProxy.position.copy(shell.position).setY(shell.position.y + HOVER_LIFT / 2)
  hitProxy.scale.set(1, 1 + HOVER_LIFT / (2 * hitRadius), 1)

  // The block, the lens frozen in it and the light inside it move as one body.
  const body = new Group()
  body.add(shell, lens, lamp)
  const focus = new Vector3()
  let presence = 0
  let lift = 0
  let lastTime: number | null = null

  const matrix = new Matrix4()
  const position = new Vector3()
  const rotation = new Quaternion()
  const scale = new Vector3()
  const turn = new Euler()
  const shards = shardGeometries.map((geometry, shape) => {
    const mine = SHARDS.filter((_, index) => index % shardGeometries.length === shape)
    const mesh = new InstancedMesh(geometry, ice, mine.length)
    mine.forEach(({ along, across, size }, index) => {
      const x = GOUGE.x * along - GOUGE.z * across
      const z = GOUGE.z * along + GOUGE.x * across
      position.set(x, groundAt(x, z) + 0.05 * size, z)
      turn.set(index * 1.3, index * 2.1 + shape, index * 0.7)
      scale.setScalar(size)
      mesh.setMatrixAt(index, matrix.compose(position, rotation.setFromEuler(turn), scale))
    })
    mesh.castShadow = true
    return mesh
  })

  const inflateShift = new Vector3()
  const tagList: IceTag[] = []

  return {
    hitTarget: hitProxy,
    tags: () => tagList,
    objects: [body, hitProxy, ...shards],
    geometries: [...cellGeometries, ...shardGeometries],
    update(time, touch, openBias = 0) {
      const step = lastTime === null ? 0 : Math.min(Math.max(time - lastTime, 0), 0.1)
      lastTime = time
      const hovered = touch !== null
      const rate = hovered ? HOVER_RISE_RATE : HOVER_SETTLE_RATE
      lift += ((hovered ? 1 : 0) - lift) * (1 - Math.exp(-step * rate))
      body.position.y = lift * (HOVER_LIFT + Math.sin(time * SWAY_SPEED * 1.1) * HOVER_SWAY)
      body.rotation.set(
        Math.sin(time * SWAY_SPEED * 0.7) * 0.03 * lift,
        Math.sin(time * SWAY_SPEED * 0.4) * 0.07 * lift,
        Math.cos(time * SWAY_SPEED * 0.9) * 0.03 * lift,
      )
      body.updateMatrixWorld()

      if (touch) {
        // On first contact the focus starts where the pointer is, rather than gliding in from
        // wherever it was last left.
        if (presence < 0.02) focus.copy(touch)
        else focus.lerp(touch, 1 - Math.exp(-step * FOCUS_RATE))
      }
      const presenceRate = hovered ? PRESENCE_RISE_RATE : PRESENCE_FALL_RATE
      presence += ((hovered ? 1 : 0) - presence) * (1 - Math.exp(-step * presenceRate))

      let open = 0
      tagList.length = 0
      for (const cell of cells) {
        cell.world.copy(cell.centre).applyMatrix4(shell.matrixWorld)
        const distance = cell.world.distanceTo(focus)
        const reach = Math.min(Math.max(1 - distance / CELL_REACH, 0), 1)
        const target = reach * reach * (3 - 2 * reach) * cell.mobility * presence
        cell.wait = target > 0.01 ? Math.max(cell.wait - step, 0) : cell.delay
        const gated = Math.max(cell.wait > 0 ? 0 : target, openBias * cell.mobility)
        cell.speed += ((gated - cell.push) * CELL_STIFFNESS - cell.speed * CELL_DAMPING) * step
        cell.push += cell.speed * step
        const inhale = breathAt(time / BREATH_CYCLE_S - cell.phase * BREATH_WAVE)
        const breathing =
          inhale * BREATH_TRAVEL * (BREATH_ANCHOR + (1 - BREATH_ANCHOR) * cell.mobility)
        const out = Math.max(cell.push, 0)
        cell.mesh.quaternion.setFromAxisAngle(
          cell.axis,
          (cell.push + inhale * BREATH_TURN * cell.mobility) * cell.turn,
        )
        cell.mesh.position
          .copy(cell.outward)
          .multiplyScalar(out * CELL_TRAVEL + breathing)
          .add(
            inflateShift
              .copy(cell.centre)
              .applyQuaternion(cell.mesh.quaternion)
              .multiplyScalar(1 - CELL_INFLATE),
          )
        open = Math.max(
          open,
          out / Math.max(cell.mobility, 0.5),
          inhale * BREATH_GLOW * cell.mobility,
        )
        if (out > TAG_THRESHOLD && cell.mobility > 0.5) {
          tagList.push({ id: cell.id, position: cell.world, strength: Math.min(out, 1) })
        }
      }
      opened.value = Math.min(open, 1)

      const breath = breathAt(time / BREATH_CYCLE_S)
      pulse.value = breath
      lensClock.value = time * LENS_DRIFT
      // Opened, the light inside answers: it is what the gap is opening onto.
      lensGain.value = (0.62 + 0.4 * breath) * (1 + 1.2 * open)
      lamp.intensity = (9 + 14 * breath) * (1 + 0.6 * lift + 1.2 * open)
    },
    dispose() {
      for (const geometry of cellGeometries) geometry.dispose()
      for (const geometry of shardGeometries) geometry.dispose()
      for (const mesh of shards) mesh.dispose()
      lens.geometry.dispose()
      lens.material.dispose()
      hitProxy.geometry.dispose()
      hitProxy.material.dispose()
      ice.dispose()
    },
  }
}
