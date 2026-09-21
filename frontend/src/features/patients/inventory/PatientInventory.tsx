import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'
import type { PatientSummary } from '../../../api/schemas'
import { allowsMotion } from '../../../shared/motion/allowsMotion'
import { createInventoryScene, type InventoryScene } from './createInventoryScene'
import { initialsOf } from './initials'
import styles from './PatientInventory.module.css'

// The blocks are small and refractive; past 1.5x the GPU pays for detail no one can see.
const MAX_PIXEL_RATIO = 1.5

type SceneState = 'loading' | 'ready' | 'fallback'

interface PatientInventoryProps {
  patients: readonly PatientSummary[]
}

// Each patient is a tile: the link, name and number are ordinary HTML, so the list works with a
// keyboard, a screen reader or no WebGL at all. One canvas over the grid draws an ice block into
// every tile's slot; the initials in the slot stand in until it loads, and without WebGL.
export function PatientInventory({ patients }: PatientInventoryProps) {
  const wrapperRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const sceneRef = useRef<InventoryScene | null>(null)
  const [sceneState, setSceneState] = useState<SceneState>('loading')
  const [hovered, setHovered] = useState<number | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const scene = createInventoryScene(canvas, {
      assetBase: import.meta.env.BASE_URL,
      moving: allowsMotion(),
      onReady: () => setSceneState('ready'),
      onError: (error) => {
        console.error('Patient inventory scene failed to load:', error)
        setSceneState('fallback')
      },
    })
    if (!scene) {
      setSceneState('fallback')
      return
    }
    sceneRef.current = scene
    return () => {
      scene.dispose()
      sceneRef.current = null
    }
  }, [])

  useEffect(() => {
    const wrapper = wrapperRef.current
    const scene = sceneRef.current
    if (!wrapper || !scene) return

    const measure = () => {
      const box = wrapper.getBoundingClientRect()
      scene.resize(box.width, box.height, Math.min(window.devicePixelRatio || 1, MAX_PIXEL_RATIO))
      const slotElements = wrapper.querySelectorAll<HTMLElement>('[data-block-slot]')
      scene.setSlots(
        Array.from(slotElements, (slot) => {
          const rect = slot.getBoundingClientRect()
          return {
            x: rect.left - box.left + rect.width / 2,
            y: rect.top - box.top + rect.height / 2,
            size: rect.width,
          }
        }),
      )
    }

    measure()
    const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(measure) : null
    observer?.observe(wrapper)
    return () => observer?.disconnect()
  }, [patients])

  useEffect(() => {
    sceneRef.current?.setHovered(hovered)
  }, [hovered])

  return (
    <div ref={wrapperRef} className={styles.inventory} data-scene={sceneState}>
      <canvas ref={canvasRef} className={styles.canvas} aria-hidden="true" />
      <ul className={styles.grid} aria-label="Patients">
        {patients.map((patient, index) => (
          <li key={patient.id}>
            <Link
              to={`/patients/${patient.id}`}
              className={styles.tile}
              onPointerEnter={() => setHovered(index)}
              onPointerLeave={() => setHovered(null)}
              onFocus={() => setHovered(index)}
              onBlur={() => setHovered(null)}
            >
              <span className={styles.slot} data-block-slot aria-hidden="true">
                <span className={styles.initials}>{initialsOf(patient.name)}</span>
              </span>
              <span className={styles.name}>{patient.name}</span>
              <span className={styles.personalNumber}>{patient.personalNumber}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
