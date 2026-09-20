import {
  BufferGeometry,
  DoubleSide,
  Euler,
  IcosahedronGeometry,
  InstancedMesh,
  Matrix4,
  MeshStandardMaterial,
  Quaternion,
  Vector3,
  type Object3D,
} from 'three'
import type { Haze } from './haze'
import { findGeometry, GOUGE, patchShader } from './sceneShared'

export interface Props {
  objects: readonly Object3D[]
  geometries: readonly BufferGeometry[]
  dispose: () => void
}

interface Placement {
  x: number
  z: number
  size: number
}

const ROCK_NAMES = ['RockA', 'RockB', 'RockC', 'RockD'] as const
const CRYSTAL_NAMES = ['CrystalA', 'CrystalB'] as const
const MODEL_FILE = 'props.glb'
const SITE_ROCKS = 480
const FIELD_ROCKS = 1150
const ROCK_FIELDS = 48
const CRYSTAL_GARDENS = 30
const SITE_REACH = 76
// A few boulders close to the camera, placed by hand as distance ahead of it and distance to its
// left. They are the darkest, nearest thing in the frame: without them the foreground is an empty
// bright band and the basin has no scale.
const HERO_ROCKS = [
  { ahead: 9, left: 13, size: 4.2 },
  { ahead: 12, left: -16, size: 3.4 },
  { ahead: 17, left: 24, size: 2.6 },
  { ahead: 21, left: -27, size: 3.8 },
  { ahead: 27, left: 8, size: 2.2 },
] as const
// How far out the basin is dressed. Past this the haze has taken nearly everything anyway.
const FIELD_REACH = 430
// Open sand around the crater: the block reads as the subject because nothing crowds it.
const BLOCK_CLEARING = 13
const CRYSTAL_CLEARING = 24
const GOUGE_LENGTH = 48
const GOUGE_CLEARING = 5
// Where the camera first stands, and the way it first looks: the densest rocks gather in front
// of it, because the near ones are what give the basin its scale. Must follow START_ANGLE and the
// opening radius in createLandingScene.
const VIEWPOINT = { x: -86.7, z: 24.1 }
const AHEAD = { x: 0.96, z: -0.27 }
const LEFT = { x: -0.27, z: -0.96 }

// Seeded, so the scatter is the same composition on every visit.
function createRandom(seed: number): () => number {
  let state = seed
  return () => {
    state = (state + 0x6d2b79f5) | 0
    let t = Math.imul(state ^ (state >>> 15), 1 | state)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function isClear(x: number, z: number): boolean {
  if (Math.hypot(x, z) < BLOCK_CLEARING) return false
  if (Math.hypot(x - VIEWPOINT.x, z - VIEWPOINT.z) < 5) return false
  const along = x * GOUGE.x + z * GOUGE.z
  const across = Math.abs(-x * GOUGE.z + z * GOUGE.x)
  return !(along > 0 && along < GOUGE_LENGTH && across < GOUGE_CLEARING)
}

function scatterSiteRocks(random: () => number): Placement[] {
  const placements: Placement[] = []
  while (placements.length < SITE_ROCKS) {
    // Two populations: a fan in front of the viewpoint, and a thin cover over the whole site.
    const nearViewpoint = random() < 0.62
    const distance = 6 + 60 * Math.pow(random(), 1.6)
    const spread = (random() - 0.5) * (14 + distance * 0.9)
    const x = nearViewpoint
      ? VIEWPOINT.x + AHEAD.x * distance + LEFT.x * spread
      : (random() * 2 - 1) * SITE_REACH
    const z = nearViewpoint
      ? VIEWPOINT.z + AHEAD.z * distance + LEFT.z * spread
      : (random() * 2 - 1) * SITE_REACH
    if (Math.abs(x) > SITE_REACH || Math.abs(z) > SITE_REACH || !isClear(x, z)) continue
    // Mostly pebbles and stones, with the occasional boulder.
    placements.push({ x, z, size: 0.08 + 1.3 * Math.pow(random(), 5) })
  }
  return placements
}

// Out in the basin rocks lie in fields, the way scree gathers, with open sand between them; an
// even sprinkle reads as noise. They grow with distance so the far fields still register.
function scatterFieldRocks(random: () => number): Placement[] {
  const fields = Array.from({ length: ROCK_FIELDS }, () => {
    const angle = random() * Math.PI * 2
    const distance = 70 + (FIELD_REACH - 70) * Math.pow(random(), 0.8)
    return {
      x: Math.sin(angle) * distance,
      z: Math.cos(angle) * distance,
      spread: 10 + 34 * random(),
    }
  })
  const placements: Placement[] = []
  while (placements.length < FIELD_ROCKS) {
    const field = fields[Math.floor(random() * fields.length)]
    const loose = random() < 0.22 || !field
    const angle = random() * Math.PI * 2
    const reach = SITE_REACH + (FIELD_REACH - SITE_REACH) * Math.pow(random(), 0.7)
    const x = loose
      ? Math.sin(angle) * reach
      : field.x + (random() + random() + random() - 1.5) * field.spread * 1.3
    const z = loose
      ? Math.cos(angle) * reach
      : field.z + (random() + random() + random() - 1.5) * field.spread * 1.3
    if (Math.max(Math.abs(x), Math.abs(z)) < SITE_REACH) continue
    const distance = Math.hypot(x, z)
    placements.push({ x, z, size: (0.35 + 3 * Math.pow(random(), 3.2)) * (1 + distance / 260) })
  }
  return placements
}

// Crystals grow in gardens of a few clusters each, all through the basin, and keep a respectful
// distance from the block so they frame it instead of competing with it.
function scatterCrystals(random: () => number): Placement[] {
  const placements: Placement[] = []
  while (placements.length < CRYSTAL_GARDENS * 3) {
    const angle = random() * Math.PI * 2
    const distance = CRYSTAL_CLEARING + (FIELD_REACH - 60) * Math.pow(random(), 1.5)
    const gardenX = Math.sin(angle) * distance
    const gardenZ = Math.cos(angle) * distance
    const scale = 1 + distance / 180
    const clusters = 2 + Math.floor(random() * 3)
    for (let i = 0; i < clusters; i++) {
      const x = gardenX + (random() - 0.5) * 7 * scale
      const z = gardenZ + (random() - 0.5) * 7 * scale
      if (Math.hypot(x, z) < CRYSTAL_CLEARING || !isClear(x, z)) continue
      placements.push({ x, z, size: (0.28 + 0.75 * Math.pow(random(), 2)) * scale })
    }
  }
  return placements
}

// Bare stone reads as plastic. Two things fix most of that for almost nothing: a coarse speckle so
// no face is one flat value, and sand lying on whatever faces up, which also ties each rock to
// the ground it sits on.
const STONE = /* glsl */ `
#include <color_fragment>
vec3 stoneNormal = inverseTransformDirection(normalize(vNormal), viewMatrix);
vec3 stoneCell = floor(vHazeWorld * 7.0);
float stoneGrain = fract(sin(dot(stoneCell, vec3(12.9898, 78.233, 37.719))) * 43758.5453);
float stoneDust = smoothstep(0.5, 0.92, stoneNormal.y);
diffuseColor.rgb = mix(diffuseColor.rgb * (0.74 + 0.4 * stoneGrain), vec3(0.6, 0.45, 0.31), stoneDust * 0.75);
`

// Light passing through the crystal toward the eye, and light glancing off its edges: both are
// strongest looking sunward, which is exactly where a plain solid would be a black cut-out.
const CRYSTAL_GLOW = /* glsl */ `
#include <emissivemap_fragment>
float crystalThrough = pow(max(dot(normalize(-vViewPosition), uSunView), 0.0), 2.5);
float crystalRim = pow(1.0 - max(dot(normalize(vViewPosition), normal), 0.0), 2.5);
totalEmissiveRadiance += vec3(0.8, 0.14, 0.06) * (crystalThrough * 0.3 + crystalRim * 0.3 * (0.3 + crystalThrough));
`

// A stone for the far fields: an 80-triangle ball pushed out of round by its own direction (so
// shared corners move together and the surface stays closed), flattened, and cut off underneath.
function createFieldRock(squash: number, stretch: number): BufferGeometry {
  const geometry = new IcosahedronGeometry(1, 1)
  const position = geometry.getAttribute('position')
  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i)
    const y = position.getY(i)
    const z = position.getZ(i)
    const lump =
      1 + 0.28 * Math.sin(x * 3.1 + z * 1.7) + 0.2 * Math.sin(y * 4.3 - x * 2.2 + stretch)
    position.setXYZ(i, x * lump * stretch, Math.max(y * lump * squash, -0.3), z * lump)
  }
  geometry.computeVertexNormals()
  return geometry
}

export function createProps(
  root: Object3D,
  groundAt: (x: number, z: number) => number,
  haze: Haze,
): Props {
  const random = createRandom(20260920)
  const rockMaterial = new MeshStandardMaterial({ color: '#8d715b', roughness: 0.9 })
  // Garnet glass. A solid this dark goes black against the light, which real crystal never does:
  // seen toward the sun it lights up from inside (see CRYSTAL_GLOW).
  const crystalMaterial = new MeshStandardMaterial({
    color: '#5c170e',
    // Rough enough that a facet catching the sun shows as a soft sheen, not a white flare.
    roughness: 0.34,
    metalness: 0,
    emissive: '#3c0d07',
    emissiveIntensity: 0.6,
    flatShading: true,
    // The prisms are open where they meet the ground.
    side: DoubleSide,
  })
  haze.apply(rockMaterial, (shader) => {
    shader.fragmentShader = patchShader(shader.fragmentShader, [
      ['#include <color_fragment>', STONE],
    ])
  })
  haze.apply(crystalMaterial, (shader) => {
    shader.fragmentShader = patchShader(shader.fragmentShader, [
      ['#include <emissivemap_fragment>', CRYSTAL_GLOW],
    ])
  })

  const matrix = new Matrix4()
  const position = new Vector3()
  const rotation = new Quaternion()
  const scale = new Vector3()
  const turn = new Euler()

  const rockGeometries = ROCK_NAMES.map((name) => findGeometry(root, name, MODEL_FILE))
  const crystalGeometries = CRYSTAL_NAMES.map((name) => findGeometry(root, name, MODEL_FILE))

  const crystalPlacements = scatterCrystals(random)
  const heroRocks = HERO_ROCKS.map(({ ahead, left, size }) => ({
    x: VIEWPOINT.x + AHEAD.x * ahead + LEFT.x * left,
    z: VIEWPOINT.z + AHEAD.z * ahead + LEFT.z * left,
    size,
  }))
  const instanceRocks = (
    geometries: readonly BufferGeometry[],
    placements: readonly Placement[],
    shadowed: boolean,
  ) =>
    geometries.map((geometry, shape) => {
      const mine = placements.filter((_, index) => index % geometries.length === shape)
      const mesh = new InstancedMesh(geometry, rockMaterial, mine.length)
      mine.forEach(({ x, z, size }, index) => {
        // Sunk a little, so nothing sits on the sand like a dropped ball.
        position.set(x, groundAt(x, z) - size * 0.2, z)
        turn.set((random() - 0.5) * 0.4, random() * Math.PI * 2, (random() - 0.5) * 0.4)
        scale.set(size, size * (0.75 + random() * 0.4), size * (0.8 + random() * 0.4))
        mesh.setMatrixAt(index, matrix.compose(position, rotation.setFromEuler(turn), scale))
      })
      mesh.castShadow = shadowed
      mesh.receiveShadow = shadowed
      return mesh
    })
  // The far fields lie outside the sun's shadow map and are never seen closely, so they get
  // rough low-polygon stones and no shadows: most of the rocks, a fraction of the cost.
  const fieldGeometries = [createFieldRock(0.6, 1.3), createFieldRock(0.9, 1)]
  const rocks = [
    ...instanceRocks(rockGeometries, [...heroRocks, ...scatterSiteRocks(random)], true),
    ...instanceRocks(fieldGeometries, scatterFieldRocks(random), false),
  ]

  const crystals = crystalGeometries.map((geometry, shape) => {
    const mine = crystalPlacements.filter((_, index) => index % crystalGeometries.length === shape)
    const mesh = new InstancedMesh(geometry, crystalMaterial, mine.length)
    mine.forEach(({ x, z, size }, index) => {
      position.set(x, groundAt(x, z) - 0.1 * size, z)
      turn.set(0, random() * Math.PI * 2, 0)
      scale.setScalar(size)
      mesh.setMatrixAt(index, matrix.compose(position, rotation.setFromEuler(turn), scale))
    })
    mesh.castShadow = true
    return mesh
  })

  const geometries = [...rockGeometries, ...crystalGeometries, ...fieldGeometries]
  return {
    objects: [...rocks, ...crystals],
    geometries,
    dispose() {
      for (const geometry of geometries) geometry.dispose()
      for (const mesh of [...rocks, ...crystals]) mesh.dispose()
      rockMaterial.dispose()
      crystalMaterial.dispose()
    },
  }
}
