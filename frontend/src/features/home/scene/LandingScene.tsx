import { useEffect, useRef } from 'react'
import { allowsMotion } from '../../../shared/motion/allowsMotion'
import { createLandingScene, type LandingScene as Scene, type SceneTag } from './createLandingScene'
import canvasStyles from '../../auth/liquid/LiquidCanvas.module.css'
import styles from './LandingScene.module.css'

// Geometry edges want more density than the login's soft liquid did, but integrated GPUs pay
// for every pixel of the shadowed terrain.
const MAX_PIXEL_RATIO = 1.5
const STILL_FRAME_TIME = 18
const POINTER_FOLLOW = 0.04
const SCROLL_FOLLOW = 0.06
const MAX_FRAME_STEP_S = 0.05
// Only the pieces pushed out furthest are numbered; more than this reads as clutter.
const TAG_SLOTS = 5
// Once the whole first screen has scrolled away and the camera has finished its move, the scene
// is only seen blurred through the glass sections, where a held frame is indistinguishable from
// a live one and costs nothing. While any of it shows clear, it keeps running: the ice pulses.
const SETTLED = 0.002
// Coming out of the lens. The login dive ends inside it and the block holds the same lens, so the
// camera starts there and withdraws. Deliberately shorter than the dive: this is the tail of a
// move already under way, not a second announcement.
const ARRIVAL_MS = 1600

export interface LandingSceneProps {
  className?: string
  // The journal covers the whole viewport and locks scrolling, so the scene's own
  // "scrolled past it" test never fires and a bloom pipeline would keep rendering
  // every frame behind an opaque panel.
  paused?: boolean
}

function sizeToElement(scene: Scene, canvas: HTMLCanvasElement) {
  const rect = canvas.getBoundingClientRect()
  scene.resize(rect.width, rect.height, Math.min(window.devicePixelRatio || 1, MAX_PIXEL_RATIO))
}

export function LandingScene({ className, paused = false }: LandingSceneProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const hudRef = useRef<HTMLDivElement>(null)
  // Read inside the loop, which is set up once and outlives any prop change.
  const pausedRef = useRef(paused)
  const controlsRef = useRef<{ start: () => void; stop: () => void } | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const moving = allowsMotion()
    const pointerTarget = { x: 0, y: 0 }
    const pointer = { x: 0, y: 0 }
    let hover: { x: number; y: number } | null = null
    let elapsed = moving ? 0 : STILL_FRAME_TIME
    let scroll = 0
    let lastNow = performance.now()
    let frame = 0
    let running = false
    let ready = false
    // Only when the shell says this load came through the dive, and only if motion is allowed.
    // It never gates readiness: if this never runs, the scene simply opens already arrived.
    const byDive = moving && canvas.closest('[data-settle-in="true"]') !== null
    let arrivedAt: number | null = null
    let arrival = byDive ? 0 : 1

    // These close over scene, declared below: safe because the scene only calls back once its
    // files have loaded, which is never within the call that creates it.
    const drawStill = () => {
      scene?.render({ time: elapsed, pointerX: 0, pointerY: 0, hover: null, scroll: 0 })
    }

    const draw = (now: number) => {
      elapsed += Math.min(Math.max(now - lastNow, 0) / 1000, MAX_FRAME_STEP_S)
      lastNow = now
      pointer.x += (pointerTarget.x - pointer.x) * POINTER_FOLLOW
      pointer.y += (pointerTarget.y - pointer.y) * POINTER_FOLLOW
      // The page may not be a full viewport taller than the screen, so the camera's move is
      // spread over however far it can actually scroll, up to one viewport.
      const scrollable = document.documentElement.scrollHeight - window.innerHeight
      const travel = Math.max(Math.min(window.innerHeight, scrollable), 1)
      const scrollTarget = Math.min(Math.max(window.scrollY / travel, 0), 1)
      scroll += (scrollTarget - scroll) * SCROLL_FOLLOW
      if (arrival < 1) {
        if (arrivedAt === null) arrivedAt = now
        const t = Math.min((now - arrivedAt) / ARRIVAL_MS, 1)
        // ease-out-expo: nearly all of the distance is covered early, so the eye leaves the ice
        // quickly and the last of the move is a settle rather than a drift.
        arrival = t === 1 ? 1 : 1 - Math.pow(2, -10 * t)
      }
      scene?.render({
        time: elapsed,
        pointerX: pointer.x,
        pointerY: pointer.y,
        hover,
        scroll,
        arrival,
      })
      const covered = window.scrollY >= window.innerHeight
      if (covered && Math.abs(scrollTarget - scroll) < SETTLED) running = false
      if (running) frame = requestAnimationFrame(draw)
    }

    const start = () => {
      if (running || !ready || !moving || document.hidden || pausedRef.current) return
      running = true
      lastNow = performance.now()
      frame = requestAnimationFrame(draw)
    }

    const stop = () => {
      running = false
      cancelAnimationFrame(frame)
    }

    // The dive can be skipped with any key or click; so can its tail.
    const skipArrival = () => {
      arrival = 1
    }
    if (byDive) {
      window.addEventListener('keydown', skipArrival, { once: true })
      window.addEventListener('pointerdown', skipArrival, { once: true })
      window.addEventListener('wheel', skipArrival, { once: true, passive: true })
    }

    // The marks follow the ice every frame, so they are moved directly instead of through React.
    const slots = Array.from(hudRef.current?.querySelectorAll<HTMLElement>('[data-tag]') ?? [])
    const links = hudRef.current?.querySelector('polyline') ?? null
    const onTags = (tags: readonly SceneTag[]) => {
      const shown = [...tags].sort((a, b) => b.strength - a.strength).slice(0, slots.length)
      slots.forEach((slot, index) => {
        const tag = shown[index]
        slot.style.opacity = tag ? String(tag.strength) : '0'
        if (!tag) return
        slot.style.transform = `translate(${tag.x}px, ${tag.y}px)`
        slot.textContent = String(tag.id).padStart(2, '0')
      })
      if (!links) return
      links.setAttribute('points', shown.map((tag) => `${tag.x},${tag.y}`).join(' '))
      links.style.opacity = String(shown.length > 1 ? (shown[1]?.strength ?? 0) : 0)
    }

    const scene = createLandingScene(canvas, {
      assetBase: import.meta.env.BASE_URL,
      onTags,
      onReady: () => {
        ready = true
        canvas.dataset.state = 'ready'
        if (moving) start()
        else drawStill()
      },
      onError: () => {
        canvas.dataset.state = 'fallback'
      },
    })
    if (!scene) {
      canvas.dataset.state = 'fallback'
      return
    }
    sizeToElement(scene, canvas)

    const onPointerMove = (event: PointerEvent) => {
      pointerTarget.x = event.clientX / window.innerWidth - 0.5
      pointerTarget.y = event.clientY / window.innerHeight - 0.5
      // A finger has no hover: a tap would leave the block hanging until the next one.
      hover =
        event.pointerType === 'mouse'
          ? {
              x: (event.clientX / window.innerWidth) * 2 - 1,
              y: 1 - (event.clientY / window.innerHeight) * 2,
            }
          : null
    }

    const onPointerLeave = () => {
      hover = null
    }

    const onScroll = () => start()

    const onVisibilityChange = () => {
      if (document.hidden) stop()
      else start()
    }

    const onContextLost = (event: Event) => {
      event.preventDefault()
      stop()
      canvas.dataset.state = 'fallback'
    }

    const resizeObserver =
      typeof ResizeObserver === 'function'
        ? new ResizeObserver(() => {
            sizeToElement(scene, canvas)
            if (ready && !moving) drawStill()
          })
        : null

    resizeObserver?.observe(canvas)
    if (moving) window.addEventListener('pointermove', onPointerMove, { passive: true })
    document.documentElement.addEventListener('pointerleave', onPointerLeave)
    window.addEventListener('scroll', onScroll, { passive: true })
    document.addEventListener('visibilitychange', onVisibilityChange)
    canvas.addEventListener('webglcontextlost', onContextLost)
    controlsRef.current = { start, stop }

    return () => {
      controlsRef.current = null
      stop()
      resizeObserver?.disconnect()
      window.removeEventListener('pointermove', onPointerMove)
      document.documentElement.removeEventListener('pointerleave', onPointerLeave)
      window.removeEventListener('scroll', onScroll)
      document.removeEventListener('visibilitychange', onVisibilityChange)
      canvas.removeEventListener('webglcontextlost', onContextLost)
      window.removeEventListener('keydown', skipArrival)
      window.removeEventListener('pointerdown', skipArrival)
      window.removeEventListener('wheel', skipArrival)
      scene.dispose()
    }
  }, [])

  useEffect(() => {
    pausedRef.current = paused
    if (paused) controlsRef.current?.stop()
    else controlsRef.current?.start()
  }, [paused])

  return (
    <>
      <canvas
        ref={canvasRef}
        className={className ? `${canvasStyles.canvas} ${className}` : canvasStyles.canvas}
        aria-hidden="true"
      />
      <div ref={hudRef} className={styles.hud} aria-hidden="true">
        <svg className={styles.links}>
          <polyline />
        </svg>
        {Array.from({ length: TAG_SLOTS }, (_, index) => (
          <span key={index} data-tag className={styles.tag} />
        ))}
      </div>
    </>
  )
}
