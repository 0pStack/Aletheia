import { useEffect, type RefObject } from 'react'

const MOTION_QUERY = '(pointer: fine) and (prefers-reduced-motion: no-preference)'
// Fraction of the remaining distance covered per frame: low values make the light trail the cursor.
const FOLLOW_FACTOR = 0.08
const SETTLE_THRESHOLD_PX = 0.5

function allowsPointerMotion(): boolean {
  return typeof window.matchMedia === 'function' && window.matchMedia(MOTION_QUERY).matches
}

// Writes the smoothed pointer position into CSS custom properties on the element, so all
// movement stays in CSS transforms and React never re-renders per frame.
export function usePointerGlow(ref: RefObject<HTMLElement | null>): void {
  useEffect(() => {
    const element = ref.current
    if (!element || !allowsPointerMotion()) return

    const target = { x: 0, y: 0, nx: 0.5, ny: 0.5 }
    const current = { x: 0, y: 0, nx: 0.5, ny: 0.5 }
    let frame = 0

    const tick = () => {
      current.x += (target.x - current.x) * FOLLOW_FACTOR
      current.y += (target.y - current.y) * FOLLOW_FACTOR
      current.nx += (target.nx - current.nx) * FOLLOW_FACTOR
      current.ny += (target.ny - current.ny) * FOLLOW_FACTOR

      element.style.setProperty('--glow-x', `${current.x.toFixed(1)}px`)
      element.style.setProperty('--glow-y', `${current.y.toFixed(1)}px`)
      element.style.setProperty('--pointer-x', current.nx.toFixed(4))
      element.style.setProperty('--pointer-y', current.ny.toFixed(4))

      const distance = Math.abs(target.x - current.x) + Math.abs(target.y - current.y)
      frame = distance > SETTLE_THRESHOLD_PX ? requestAnimationFrame(tick) : 0
    }

    const onPointerMove = (event: PointerEvent) => {
      const rect = element.getBoundingClientRect()
      target.x = event.clientX - rect.left
      target.y = event.clientY - rect.top
      target.nx = rect.width > 0 ? target.x / rect.width : 0.5
      target.ny = rect.height > 0 ? target.y / rect.height : 0.5
      if (frame === 0) frame = requestAnimationFrame(tick)
    }

    window.addEventListener('pointermove', onPointerMove, { passive: true })
    return () => {
      window.removeEventListener('pointermove', onPointerMove)
      cancelAnimationFrame(frame)
    }
  }, [ref])
}
