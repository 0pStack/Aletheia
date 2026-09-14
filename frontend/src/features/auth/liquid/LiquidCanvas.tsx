import { useEffect, useRef } from 'react'
import { createLiquidRenderer, type LiquidRenderer } from './createLiquidRenderer'
import styles from './LiquidCanvas.module.css'

// The field is soft and grainy, so rendering above 1.25x density costs GPU time without visible gain.
const MAX_PIXEL_RATIO = 1.25
const REVEAL_MS = 2400
const STILL_FRAME_TIME = 18
const POINTER_FOLLOW = 0.05
const MAX_FRAME_STEP_S = 0.05

interface LiquidCanvasProps {
  className?: string
}

function allowsMotion(): boolean {
  return (
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: no-preference)').matches
  )
}

function easeOutCubic(progress: number): number {
  return 1 - Math.pow(1 - progress, 3)
}

const DEFAULT_LENS = { x: 0.56, y: 0.6 }

// Layout owns where the lens sits (CSS custom properties per breakpoint); read it on resize only.
function readLensCenter(canvas: HTMLCanvasElement): { x: number; y: number } {
  const style = getComputedStyle(canvas)
  const x = parseFloat(style.getPropertyValue('--lens-x'))
  const y = parseFloat(style.getPropertyValue('--lens-y'))
  return {
    x: Number.isFinite(x) ? x : DEFAULT_LENS.x,
    y: Number.isFinite(y) ? y : DEFAULT_LENS.y,
  }
}

function sizeToElement(renderer: LiquidRenderer, canvas: HTMLCanvasElement) {
  const rect = canvas.getBoundingClientRect()
  const pixelRatio = Math.min(window.devicePixelRatio || 1, MAX_PIXEL_RATIO)
  renderer.resize(rect.width, rect.height, pixelRatio)
}

export function LiquidCanvas({ className }: LiquidCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const renderer = createLiquidRenderer(canvas)
    if (!renderer) {
      canvas.dataset.state = 'fallback'
      return
    }

    sizeToElement(renderer, canvas)

    if (!allowsMotion()) {
      const drawStill = () => {
        const lens = readLensCenter(canvas)
        renderer.render({
          time: STILL_FRAME_TIME,
          pointerX: 0,
          pointerY: 0,
          reveal: 1,
          lensX: lens.x,
          lensY: lens.y,
        })
      }
      drawStill()
      canvas.dataset.state = 'ready'
      const observer =
        typeof ResizeObserver === 'function'
          ? new ResizeObserver(() => {
              sizeToElement(renderer, canvas)
              drawStill()
            })
          : null
      observer?.observe(canvas)
      return () => {
        observer?.disconnect()
        renderer.dispose()
      }
    }

    const pointerTarget = { x: 0, y: 0 }
    const pointer = { x: 0, y: 0 }
    let lens = readLensCenter(canvas)
    let elapsed = 0
    let lastNow = performance.now()
    let frame = 0
    let running = false
    let onScreen = true

    const draw = (now: number) => {
      elapsed += Math.min(Math.max(now - lastNow, 0) / 1000, MAX_FRAME_STEP_S)
      lastNow = now
      pointer.x += (pointerTarget.x - pointer.x) * POINTER_FOLLOW
      pointer.y += (pointerTarget.y - pointer.y) * POINTER_FOLLOW

      renderer.render({
        time: elapsed,
        pointerX: pointer.x,
        pointerY: pointer.y,
        reveal: easeOutCubic(Math.min((elapsed * 1000) / REVEAL_MS, 1)),
        lensX: lens.x,
        lensY: lens.y,
      })
      canvas.dataset.state = 'ready'
      if (running) frame = requestAnimationFrame(draw)
    }

    const start = () => {
      if (running || document.hidden || !onScreen) return
      running = true
      lastNow = performance.now()
      frame = requestAnimationFrame(draw)
    }

    const stop = () => {
      running = false
      cancelAnimationFrame(frame)
    }

    const onPointerMove = (event: PointerEvent) => {
      const rect = canvas.getBoundingClientRect()
      if (rect.width === 0 || rect.height === 0) return
      pointerTarget.x = (event.clientX - rect.left) / rect.width - 0.5
      pointerTarget.y = (event.clientY - rect.top) / rect.height - 0.5
    }

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
            sizeToElement(renderer, canvas)
            lens = readLensCenter(canvas)
          })
        : null
    const intersectionObserver =
      typeof IntersectionObserver === 'function'
        ? new IntersectionObserver(([entry]) => {
            onScreen = entry?.isIntersecting ?? true
            if (onScreen) start()
            else stop()
          })
        : null

    resizeObserver?.observe(canvas)
    intersectionObserver?.observe(canvas)
    window.addEventListener('pointermove', onPointerMove, { passive: true })
    document.addEventListener('visibilitychange', onVisibilityChange)
    canvas.addEventListener('webglcontextlost', onContextLost)
    start()

    return () => {
      stop()
      resizeObserver?.disconnect()
      intersectionObserver?.disconnect()
      window.removeEventListener('pointermove', onPointerMove)
      document.removeEventListener('visibilitychange', onVisibilityChange)
      canvas.removeEventListener('webglcontextlost', onContextLost)
      renderer.dispose()
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      className={className ? `${styles.canvas} ${className}` : styles.canvas}
      aria-hidden="true"
    />
  )
}
