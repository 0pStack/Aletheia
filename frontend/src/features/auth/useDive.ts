import { useEffect, useRef, useState } from 'react'
import { allowsMotion } from '../../shared/motion/allowsMotion'

export const DIVE_MS = 2000
// The crossfade used instead of the camera move: under reduced motion, and on every sign in
// after the first in a browser session, because staff sign in many times a day.
const BRIEF_DIVE_MS = 300
const SEEN_KEY = 'aletheia:dive-seen'

export type DiveMode = 'full' | 'brief'

interface Dive {
  mode: DiveMode | null
  start: () => void
}

// Only a flag that the full dive has played to its end (or was skipped); nothing about the
// user or any record is stored.
function hasSeenDive(): boolean {
  try {
    return window.sessionStorage.getItem(SEEN_KEY) === '1'
  } catch {
    return false
  }
}

function rememberDive(): void {
  try {
    window.sessionStorage.setItem(SEEN_KEY, '1')
  } catch {
    // Storage can be blocked; the only cost is seeing the full dive again.
  }
}

// Timed here rather than by the canvas, so arrival never depends on WebGL running.
export function useDive(onArrive: () => void): Dive {
  const [mode, setMode] = useState<DiveMode | null>(null)
  const arrive = useRef(onArrive)

  useEffect(() => {
    arrive.current = onArrive
  }, [onArrive])

  useEffect(() => {
    if (mode === null) return

    let arrived = false
    const finish = () => {
      if (arrived) return
      arrived = true
      if (mode === 'full') rememberDive()
      arrive.current()
    }

    const timer = setTimeout(finish, mode === 'full' ? DIVE_MS : BRIEF_DIVE_MS)
    // Any key or click skips ahead: the transition must never stand between a user and a task.
    window.addEventListener('keydown', finish)
    window.addEventListener('pointerdown', finish)

    return () => {
      clearTimeout(timer)
      window.removeEventListener('keydown', finish)
      window.removeEventListener('pointerdown', finish)
    }
  }, [mode])

  const start = () => {
    setMode(allowsMotion() && !hasSeenDive() ? 'full' : 'brief')
  }

  return { mode, start }
}
