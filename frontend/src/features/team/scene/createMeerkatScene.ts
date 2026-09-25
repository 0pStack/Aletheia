import {
  BufferAttribute,
  BufferGeometry,
  ClampToEdgeWrapping,
  Color,
  Data3DTexture,
  DataTexture,
  FloatType,
  HalfFloatType,
  LinearFilter,
  LinearSRGBColorSpace,
  OrthographicCamera,
  Points,
  RGBAFormat,
  Scene,
  ShaderMaterial,
  SRGBColorSpace,
  UnsignedByteType,
  Vector2,
  Vector3,
  Vector4,
  WebGLRenderer,
  type Texture,
} from 'three'
import { GPUComputationRenderer } from 'three/examples/jsm/misc/GPUComputationRenderer.js'
import { FIELD_SIZE, loadMeerkatField } from './meerkatField'
import {
  CUBE,
  FLOW_HEIGHT,
  FLOW_WIDTH,
  flowShader,
  PER_SLOT,
  pointsFragmentShader,
  pointsVertexShader,
  positionShader,
  SIM_SIZE,
  SLOT_COUNT,
  velocityShader,
} from './meerkatShaders'

export interface MeerkatSlot {
  /** Centre of the member's slot, in CSS pixels from the canvas's top-left corner. */
  x: number
  y: number
  height: number
}

export interface MeerkatScene {
  resize: (width: number, height: number, pixelRatio: number) => void
  setSlots: (slots: readonly MeerkatSlot[]) => void
  setStirred: (index: number | null) => void
  setPaused: (paused: boolean) => void
  dispose: () => void
}

interface MeerkatSceneOptions {
  assetBase: string
  moving: boolean
  onReady: () => void
  onError: (error: unknown) => void
}

// The meerkat stands about 0.61 units tall: a slot's height covers that and a little air.
const UNITS_PER_SLOT_HEIGHT = 0.72
const POINT_SCALE = 0.0055
const SPIN_RAD_PER_S = 0.32
// Four different angles, so the row reads as four meerkats rather than one repeated.
const START_ANGLES = [0.35, 2.1, 3.9, 5.4] as const
const STIR_S = 0.6
// About a second and a half of simulation before the first frame, so the shapes arrive formed.
const PREWARM_STEPS = 90
const MAX_STEP_S = 0.05
// A pointer that jumps further than this between events came in from elsewhere: no splat.
const MAX_POINTER_JUMP = 0.25
// From the upper left and a little in front, so each meerkat has a lit side and a shadow side.
const LIGHT = new Vector3(-0.75, 0.6, 0.35).normalize()
// Monochrome like the rest of the interface: shade that still separates from the dark glass,
// paper for the lit side, pure white for particles in flight. Display values, see the shader.
const COLOR_DARK = 0x3a3533
const COLOR_LIGHT = 0xeef1ee
const COLOR_FAST = 0xffffff
const displayColor = (hex: number) => new Color().setHex(hex, LinearSRGBColorSpace)
const OFFSCREEN = -1e5

function floatTexture(data: Float32Array): DataTexture {
  const texture = new DataTexture(data, SIM_SIZE, SIM_SIZE, RGBAFormat, FloatType)
  texture.needsUpdate = true
  return texture
}

// Each particle's home: a random point in its meerkat's cube, and a random number in w.
function seedHomes(): Float32Array {
  const data = new Float32Array(SIM_SIZE * SIM_SIZE * 4)
  for (let i = 0; i < data.length; i += 4) {
    data[i] = (Math.random() - 0.5) * CUBE
    data[i + 1] = (Math.random() - 0.5) * CUBE
    data[i + 2] = (Math.random() - 0.5) * CUBE
    data[i + 3] = Math.random()
  }
  return data
}

function fieldTexture(field: Uint8Array): Data3DTexture {
  const texture = new Data3DTexture(field, FIELD_SIZE, FIELD_SIZE, FIELD_SIZE)
  texture.format = RGBAFormat
  texture.type = UnsignedByteType
  texture.minFilter = LinearFilter
  texture.magFilter = LinearFilter
  texture.wrapS = ClampToEdgeWrapping
  texture.wrapT = ClampToEdgeWrapping
  texture.wrapR = ClampToEdgeWrapping
  texture.unpackAlignment = 1
  texture.needsUpdate = true
  return texture
}

function pointsGeometry(): BufferGeometry {
  const count = SIM_SIZE * SIM_SIZE
  const reference = new Float32Array(count * 2)
  const slot = new Float32Array(count)
  for (let i = 0; i < count; i++) {
    reference[i * 2] = ((i % SIM_SIZE) + 0.5) / SIM_SIZE
    reference[i * 2 + 1] = (Math.floor(i / SIM_SIZE) + 0.5) / SIM_SIZE
    slot[i] = Math.min(Math.floor(i / PER_SLOT), SLOT_COUNT - 1)
  }
  const geometry = new BufferGeometry()
  // three draws as many points as `position` has; the real positions come from the simulation.
  geometry.setAttribute('position', new BufferAttribute(new Float32Array(count * 3), 3))
  geometry.setAttribute('reference', new BufferAttribute(reference, 2))
  geometry.setAttribute('slot', new BufferAttribute(slot, 1))
  return geometry
}

export function createMeerkatScene(
  canvas: HTMLCanvasElement,
  { assetBase, moving, onReady, onError }: MeerkatSceneOptions,
): MeerkatScene | null {
  let renderer: WebGLRenderer
  try {
    renderer = new WebGLRenderer({ canvas, alpha: true, antialias: false })
  } catch {
    return null
  }
  renderer.outputColorSpace = SRGBColorSpace
  renderer.setClearColor(0x000000, 0)

  // Uniform values shared by every pass. three reads them each frame, so they change in place.
  const angles: number[] = [...START_ANGLES]
  const stirs = [0, 0, 0, 0]
  const stirredAt: (number | null)[] = [null, null, null, null]
  const slotPlaces = Array.from({ length: SLOT_COUNT }, () => new Vector4(OFFSCREEN, 0, 1, 0))
  const viewport = new Vector2(1, 1)
  const flowPointer = new Vector2(-1, -1)
  const flowMove = new Vector2()
  const field = { value: null as Data3DTexture | null }
  const flowTexture = { value: null as Texture | null }
  const time = { value: 0 }
  const step = { value: 1 }
  const interact = { value: 0 }
  const aspect = { value: 1 }
  const pixelRatio = { value: 1 }
  const drawnPosition = { value: null as Texture | null }
  const drawnVelocity = { value: null as Texture | null }

  const homes = seedHomes()
  const home = floatTexture(homes)

  // Float targets where the GPU can render to them; half floats hold 0.3-unit positions to
  // about a tenth of a pixel, which is enough where they cannot.
  const particles = new GPUComputationRenderer(SIM_SIZE, SIM_SIZE, renderer)
  particles.setDataType(
    renderer.extensions.has('EXT_color_buffer_float') ? FloatType : HalfFloatType,
  )
  const velocity = particles.addVariable(
    'textureVelocity',
    velocityShader,
    floatTexture(new Float32Array(homes.length)),
  )
  const position = particles.addVariable(
    'texturePosition',
    positionShader,
    floatTexture(homes.slice()),
  )
  particles.setVariableDependencies(velocity, [position, velocity])
  particles.setVariableDependencies(position, [position, velocity])

  const flow = new GPUComputationRenderer(FLOW_WIDTH, FLOW_HEIGHT, renderer)
  flow.setDataType(HalfFloatType)
  const flowField = flow.addVariable('textureFlow', flowShader, flow.createTexture())
  flow.setVariableDependencies(flowField, [flowField])
  // Particles read the flow between its texels, and the flow reads itself as it drifts.
  flowField.minFilter = LinearFilter
  flowField.magFilter = LinearFilter

  const shared = { tField: field, uAngle: { value: angles }, uStir: { value: stirs } }
  Object.assign(velocity.material.uniforms, shared, {
    tHome: { value: home },
    tFlow: flowTexture,
    uSlots: { value: slotPlaces },
    uViewport: { value: viewport },
    uTime: time,
    uStep: step,
    uInteract: interact,
  })
  Object.assign(position.material.uniforms, shared, { uStep: step, uLight: { value: LIGHT } })
  Object.assign(flowField.material.uniforms, {
    uPointer: { value: flowPointer },
    uPointerMove: { value: flowMove },
    uAspect: aspect,
    uStep: step,
  })

  // init() returns an error message or null, so the flow is only set up if the particles were.
  const initError = particles.init() ?? flow.init()
  if (initError !== null) {
    particles.dispose()
    flow.dispose()
    home.dispose()
    renderer.dispose()
    return null
  }

  const material = new ShaderMaterial({
    vertexShader: pointsVertexShader,
    fragmentShader: pointsFragmentShader,
    uniforms: {
      tPosition: drawnPosition,
      tVelocity: drawnVelocity,
      uSlots: { value: slotPlaces },
      uPointScale: { value: POINT_SCALE },
      uPixelRatio: pixelRatio,
      uColorDark: { value: displayColor(COLOR_DARK) },
      uColorLight: { value: displayColor(COLOR_LIGHT) },
      uColorFast: { value: displayColor(COLOR_FAST) },
      uLight: { value: LIGHT },
    },
    transparent: true,
  })
  const geometry = pointsGeometry()
  const points = new Points(geometry, material)
  points.frustumCulled = false
  const scene = new Scene()
  scene.add(points)
  // Pixel space: one unit is one CSS pixel, with y running down the page like the layout does.
  const camera = new OrthographicCamera(0, 1, 0, -1, -2000, 2000)

  const pointer = { x: -1, y: -1, moveX: 0, moveY: 0, known: false }
  let lastNow = 0
  let frame = 0
  let running = false
  let ready = false
  let paused = false
  let hasSlots = false
  let disposed = false

  const advance = (seconds: number, withPointer: boolean) => {
    time.value += seconds
    step.value = seconds * 60
    interact.value = withPointer ? 1 : 0
    if (moving) {
      for (let i = 0; i < SLOT_COUNT; i++) angles[i] = (angles[i] ?? 0) + SPIN_RAD_PER_S * seconds
    }
    for (let i = 0; i < SLOT_COUNT; i++) {
      const at = stirredAt[i] ?? null
      const t = at === null ? 1 : Math.min((time.value - at) / STIR_S, 1)
      stirs[i] = (1 - t) * (1 - t)
    }

    flowPointer.set(pointer.x, pointer.y)
    flowMove.set(withPointer ? pointer.moveX : 0, withPointer ? pointer.moveY : 0)
    pointer.moveX = 0
    pointer.moveY = 0
    flow.compute()
    flowTexture.value = flow.getCurrentRenderTarget(flowField).texture
    particles.compute()
  }

  const draw = () => {
    drawnPosition.value = particles.getCurrentRenderTarget(position).texture
    drawnVelocity.value = particles.getCurrentRenderTarget(velocity).texture
    renderer.render(scene, camera)
  }

  const loop = (now: number) => {
    if (!running) return
    advance(Math.min(Math.max(now - lastNow, 0) / 1000, MAX_STEP_S), true)
    lastNow = now
    draw()
    frame = requestAnimationFrame(loop)
  }

  const onPointerMove = (event: PointerEvent) => {
    const box = canvas.getBoundingClientRect()
    if (box.width === 0 || box.height === 0) return
    const x = (event.clientX - box.left) / box.width
    const y = 1 - (event.clientY - box.top) / box.height
    if (pointer.known && Math.hypot(x - pointer.x, y - pointer.y) < MAX_POINTER_JUMP) {
      pointer.moveX += x - pointer.x
      pointer.moveY += y - pointer.y
    }
    pointer.x = x
    pointer.y = y
    pointer.known = true
  }

  const startLoop = () => {
    if (running || disposed || !ready || !moving || paused || !hasSlots) return
    running = true
    pointer.known = false
    lastNow = performance.now()
    window.addEventListener('pointermove', onPointerMove, { passive: true })
    frame = requestAnimationFrame(loop)
  }

  const stopLoop = () => {
    running = false
    cancelAnimationFrame(frame)
    window.removeEventListener('pointermove', onPointerMove)
  }

  // Without motion, one still frame stands in for the loop, redrawn only when the layout moves.
  const refresh = () => {
    if (!ready || disposed) return
    if (moving) startLoop()
    else draw()
  }

  const onContextLost = (event: Event) => {
    event.preventDefault()
    stopLoop()
    onError(new Error('WebGL context lost'))
  }
  canvas.addEventListener('webglcontextlost', onContextLost)

  loadMeerkatField(assetBase)
    .then((bytes) => {
      if (disposed) return
      field.value = fieldTexture(bytes)
      for (let i = 0; i < PREWARM_STEPS; i++) advance(1 / 60, false)
      ready = true
      onReady()
      refresh()
    })
    .catch((error: unknown) => {
      if (!disposed) onError(error)
    })

  return {
    resize(width, height, ratio) {
      renderer.setPixelRatio(ratio)
      renderer.setSize(width, height, false)
      viewport.set(Math.max(width, 1), Math.max(height, 1))
      aspect.value = viewport.x / viewport.y
      pixelRatio.value = ratio
      // A canvas measured before layout is 0 x 0, which would make a degenerate projection.
      camera.right = viewport.x
      camera.bottom = -viewport.y
      camera.updateProjectionMatrix()
      refresh()
    },
    setSlots(slots) {
      slotPlaces.forEach((place, i) => {
        const slot = slots[i]
        if (slot) place.set(slot.x, slot.y, slot.height / UNITS_PER_SLOT_HEIGHT, 0)
        else place.set(OFFSCREEN, 0, 1, 0)
      })
      hasSlots = slots.length > 0
      refresh()
    },
    setStirred(index) {
      if (index === null || !moving || index < 0 || index >= SLOT_COUNT) return
      stirredAt[index] = time.value
    },
    setPaused(next) {
      paused = next
      if (paused) stopLoop()
      else refresh()
    },
    dispose() {
      disposed = true
      stopLoop()
      canvas.removeEventListener('webglcontextlost', onContextLost)
      particles.dispose()
      flow.dispose()
      home.dispose()
      field.value?.dispose()
      geometry.dispose()
      material.dispose()
      // Not forceContextLoss(): React remounts effects on the same canvas (StrictMode, fast
      // refresh), and a canvas whose context was forced lost cannot create another.
      renderer.dispose()
    },
  }
}
