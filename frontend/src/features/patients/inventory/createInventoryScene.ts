import {
  ACESFilmicToneMapping,
  Box3,
  Color,
  DirectionalLight,
  Group,
  Mesh,
  MeshPhysicalMaterial,
  OrthographicCamera,
  PMREMGenerator,
  Scene,
  SRGBColorSpace,
  Vector3,
  WebGLRenderer,
  type BufferGeometry,
} from 'three'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'

export interface InventorySlot {
  /** Centre of the tile's block slot, in CSS pixels from the canvas's top-left corner. */
  x: number
  y: number
  size: number
}

export interface InventoryScene {
  resize: (width: number, height: number, pixelRatio: number) => void
  setSlots: (slots: readonly InventorySlot[]) => void
  setHovered: (index: number | null) => void
  dispose: () => void
}

interface InventorySceneOptions {
  assetBase: string
  moving: boolean
  onReady: () => void
  onError: (error: unknown) => void
}

// The same ice as the landing's block, so a patient reads as a piece of that world.
const ICE_COLOR = '#9fd3de'
const ICE_ATTENUATION = '#2f9cc0'
const ICE_GLOW = new Color('#5fd0e6')
const KEY_LIGHT = '#f2d3a0'
const BLOCK_FILL = 0.74
const HOVER_LIFT = 0.07
const EASE = 0.14
const SETTLE_FRAMES = 40

// Parsed once per page: the model is the same for every block and every visit to the landing.
let blockGeometry: Promise<BufferGeometry> | null = null

function loadBlockGeometry(assetBase: string): Promise<BufferGeometry> {
  if (blockGeometry) return blockGeometry
  const draco = new DRACOLoader().setDecoderPath(`${assetBase}draco/`)
  blockGeometry = new GLTFLoader()
    .setDRACOLoader(draco)
    .loadAsync(`${assetBase}landing/block.glb`)
    .then((gltf) => {
      const source = gltf.scene.getObjectByName('IceBlock')
      if (!(source instanceof Mesh)) throw new Error('block.glb is missing the IceBlock mesh')
      // Centred and scaled to a unit cube, so a slot's size is the block's size.
      const geometry = source.geometry.clone()
      geometry.computeBoundingBox()
      const box = geometry.boundingBox ?? new Box3()
      const centre = box.getCenter(new Vector3())
      const extent = box.getSize(new Vector3())
      geometry.translate(-centre.x, -centre.y, -centre.z)
      const scale = 1 / Math.max(extent.x, extent.y, extent.z)
      geometry.scale(scale, scale, scale)
      return geometry
    })
    .catch((error: unknown) => {
      // A failed load must not stick: the next visit to the landing tries again.
      blockGeometry = null
      throw error
    })
    // The decoder keeps worker threads alive; one model is all this ever loads.
    .finally(() => draco.dispose())
  return blockGeometry
}

interface Block {
  group: Group
  ice: Mesh<BufferGeometry, MeshPhysicalMaterial>
  lift: number
  phase: number
  tilt: { x: number; y: number; z: number }
}

// Hand-cut ice never lies the same way twice. Seeded by the block's place in the list, so a block
// keeps its own lie across re-renders instead of jumping to a new one.
function tiltFor(index: number) {
  const noise = (seed: number) => {
    const s = Math.sin(index * 12.9898 + seed * 78.233) * 43758.5453
    return (s - Math.floor(s)) * 2 - 1
  }
  return { x: noise(1) * 0.14, y: noise(2) * 0.55, z: noise(3) * 0.16 }
}

export function createInventoryScene(
  canvas: HTMLCanvasElement,
  { assetBase, moving, onReady, onError }: InventorySceneOptions,
): InventoryScene | null {
  let renderer: WebGLRenderer
  try {
    renderer = new WebGLRenderer({ canvas, alpha: true, antialias: true })
  } catch {
    return null
  }
  renderer.toneMapping = ACESFilmicToneMapping
  renderer.outputColorSpace = SRGBColorSpace

  const scene = new Scene()
  const pmrem = new PMREMGenerator(renderer)
  const environment = pmrem.fromScene(new RoomEnvironment(), 0.04)
  pmrem.dispose()
  scene.environment = environment.texture
  const key = new DirectionalLight(KEY_LIGHT, 2.2)
  key.position.set(-0.6, 1, 0.8)
  scene.add(key)

  // Pixel space: one unit is one CSS pixel, with y running down the page like the layout does.
  const camera = new OrthographicCamera(0, 1, 0, -1, -4000, 4000)
  const ice = new MeshPhysicalMaterial({
    color: ICE_COLOR,
    roughness: 0.22,
    transmission: 0.95,
    thickness: 60,
    ior: 1.31,
    attenuationColor: ICE_ATTENUATION,
    attenuationDistance: 400,
    emissive: ICE_GLOW,
    emissiveIntensity: 0.04,
  })
  // The block under the pointer glows from inside, like the landing block when it opens.
  const iceLit = ice.clone()
  iceLit.emissiveIntensity = 0.32

  let geometry: BufferGeometry | null = null
  let slots: readonly InventorySlot[] = []
  let blocks: Block[] = []
  let hovered: number | null = null
  let frame = 0
  let settleFrames = 0
  let disposed = false
  const startedAt = performance.now()

  const clearBlocks = () => {
    for (const block of blocks) scene.remove(block.group)
    blocks = []
  }

  const buildBlocks = (source: BufferGeometry) => {
    clearBlocks()
    blocks = slots.map((slot, index) => {
      const group = new Group()
      group.position.set(slot.x, -slot.y, 0)
      const block = new Mesh(source, ice)
      block.scale.setScalar(slot.size * BLOCK_FILL)
      group.add(block)
      scene.add(group)
      return { group, ice: block, lift: 0, phase: index * 1.7, tilt: tiltFor(index) }
    })
    const thickness = (slots[0]?.size ?? 100) * 0.6
    ice.thickness = thickness
    iceLit.thickness = thickness
  }

  const draw = (now: number) => {
    const time = (now - startedAt) / 1000
    blocks.forEach((block, index) => {
      const slot = slots[index]
      if (!slot) return
      const active = index === hovered
      block.lift += ((active ? 1 : 0) - block.lift) * EASE
      const bob = moving ? Math.sin(time * 0.8 + block.phase) * 0.012 : 0
      block.group.position.y = -slot.y + slot.size * (HOVER_LIFT * block.lift + bob)
      // A three-quarter view, so the block reads as a solid rather than a flat tile.
      const drift = moving ? time * 0.05 : 0
      const { tilt } = block
      block.ice.rotation.set(
        0.42 + tilt.x,
        -0.62 + tilt.y + block.lift * 0.55 + drift,
        0.08 + tilt.z,
      )
      block.ice.material = active ? iceLit : ice
    })
    renderer.render(scene, camera)
  }

  // Idle motion keeps the loop running; without it, frames run only until a change has settled.
  const loop = (now: number) => {
    if (disposed) return
    draw(now)
    if (moving || settleFrames-- > 0) frame = requestAnimationFrame(loop)
  }

  const wake = () => {
    settleFrames = SETTLE_FRAMES
    cancelAnimationFrame(frame)
    frame = requestAnimationFrame(loop)
  }

  loadBlockGeometry(assetBase)
    .then((loaded) => {
      if (disposed) return
      geometry = loaded
      buildBlocks(loaded)
      onReady()
      wake()
    })
    .catch((error: unknown) => {
      if (!disposed) onError(error)
    })

  return {
    resize(width, height, pixelRatio) {
      renderer.setPixelRatio(pixelRatio)
      renderer.setSize(width, height, false)
      camera.right = width
      camera.bottom = -height
      camera.updateProjectionMatrix()
      wake()
    },
    setSlots(next) {
      slots = next
      if (geometry) buildBlocks(geometry)
      wake()
    },
    setHovered(index) {
      hovered = index
      wake()
    },
    dispose() {
      disposed = true
      cancelAnimationFrame(frame)
      clearBlocks()
      ice.dispose()
      iceLit.dispose()
      environment.dispose()
      // Not forceContextLoss(): React remounts effects on the same canvas (StrictMode, fast
      // refresh), and a canvas whose context was forced lost cannot create another. The context
      // goes when the canvas element does.
      renderer.dispose()
    },
  }
}
