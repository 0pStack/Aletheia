import { useEffect, useRef, useState } from 'react'
import { allowsMotion } from '../../shared/motion/allowsMotion'
import type { MeerkatScene } from './scene/createMeerkatScene'
import { githubProfile, TEAM_MEMBERS } from './teamMembers'
import styles from './TeamSection.module.css'

// Points are a couple of pixels wide; past 1.5x the GPU pays for sharpness no one can see.
const MAX_PIXEL_RATIO = 1.5

type SceneState = 'loading' | 'ready' | 'fallback'

interface TeamSectionProps {
  // The journal covers the page and locks scrolling, so the section can sit in view behind it
  // and would otherwise keep simulating under an opaque panel.
  paused?: boolean
}

// Starts hidden where the browser can tell; without IntersectionObserver it is simply always on.
const canObserve = () => typeof IntersectionObserver === 'function'

// Each member is ordinary HTML: name, GitHub link and track work with a keyboard, a screen reader
// or no WebGL at all. One canvas over the row forms a particle meerkat in every member's slot.
// The scene is imported dynamically, like the landing's and the inventory's, so three.js stays
// out of the bundle the login page loads.
export function TeamSection({ paused = false }: TeamSectionProps) {
  const stageRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  // State, not a ref: measuring the slots has to wait until the scene has arrived.
  const [scene, setScene] = useState<MeerkatScene | null>(null)
  const [sceneState, setSceneState] = useState<SceneState>('loading')
  const [stirred, setStirred] = useState<number | null>(null)
  const [offscreen, setOffscreen] = useState(canObserve)
  const [pageHidden, setPageHidden] = useState(() => document.hidden)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    let created: MeerkatScene | null = null
    let disposed = false

    void import('./scene/createMeerkatScene')
      .then(({ createMeerkatScene }) => {
        if (disposed) return
        created = createMeerkatScene(canvas, {
          assetBase: import.meta.env.BASE_URL,
          moving: allowsMotion(),
          onReady: () => setSceneState('ready'),
          onError: (error) => {
            console.error('Team scene failed to load:', error)
            setSceneState('fallback')
          },
        })
        if (!created) {
          setSceneState('fallback')
          return
        }
        setScene(created)
      })
      .catch((error: unknown) => {
        // The members are already on screen and work without the scene, so a chunk that fails
        // to load costs decoration, not the section.
        console.error('Team scene failed to load:', error)
        if (!disposed) setSceneState('fallback')
      })

    return () => {
      disposed = true
      created?.dispose()
      setScene(null)
    }
  }, [])

  useEffect(() => {
    const stage = stageRef.current
    const canvas = canvasRef.current
    if (!stage || !canvas || !scene) return

    // The canvas bleeds past the row so a scattered meerkat is not cut at the list's edge, so
    // slots are measured from the canvas, not the stage.
    const measure = () => {
      const box = canvas.getBoundingClientRect()
      scene.resize(box.width, box.height, Math.min(window.devicePixelRatio || 1, MAX_PIXEL_RATIO))
      const slots = stage.querySelectorAll<HTMLElement>('[data-meerkat-slot]')
      scene.setSlots(
        Array.from(slots, (slot) => {
          const rect = slot.getBoundingClientRect()
          return {
            x: rect.left - box.left + rect.width / 2,
            y: rect.top - box.top + rect.height / 2,
            height: rect.height,
          }
        }),
      )
    }

    measure()
    const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(measure) : null
    observer?.observe(stage)
    return () => observer?.disconnect()
  }, [scene])

  useEffect(() => {
    const stage = stageRef.current
    if (!stage || !canObserve()) return
    const observer = new IntersectionObserver(([entry]) => {
      if (entry) setOffscreen(!entry.isIntersecting)
    })
    observer.observe(stage)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const onVisibilityChange = () => setPageHidden(document.hidden)
    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => document.removeEventListener('visibilitychange', onVisibilityChange)
  }, [])

  useEffect(() => {
    scene?.setPaused(paused || offscreen || pageHidden)
  }, [paused, offscreen, pageHidden, scene])

  useEffect(() => {
    scene?.setStirred(stirred)
  }, [stirred, scene])

  return (
    <section className={styles.section} aria-labelledby="team-heading">
      <h2 id="team-heading" className={styles.heading}>
        Team
      </h2>
      <div ref={stageRef} className={styles.stage} data-scene={sceneState}>
        <canvas ref={canvasRef} className={styles.canvas} aria-hidden="true" />
        <ul className={styles.members} aria-label="Team members">
          {TEAM_MEMBERS.map((member, index) => (
            <li
              key={member.handle}
              className={styles.member}
              onPointerEnter={() => setStirred(index)}
              onPointerLeave={() => setStirred(null)}
              onFocus={() => setStirred(index)}
              onBlur={() => setStirred(null)}
            >
              <span className={styles.slot} data-meerkat-slot aria-hidden="true" />
              <h3 className={styles.name}>{member.name}</h3>
              <a
                className={styles.handle}
                href={githubProfile(member.handle)}
                target="_blank"
                rel="noreferrer"
                // Starts with the visible text, so speech input can still say what it sees.
                aria-label={`@${member.handle} on GitHub, opens in a new tab`}
              >
                @{member.handle}
              </a>
              <p className={styles.track}>{member.track}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
