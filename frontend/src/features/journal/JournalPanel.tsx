import { useCallback, useEffect, useRef } from 'react'
import { useLocation, useNavigate } from 'react-router'
import { JOURNAL_TITLE_ID, JournalPage } from './JournalPage'
import styles from './JournalPanel.module.css'

// The journal opens over the landing page rather than replacing it, the way igloo.inc opens a
// project over its scene: the landing stays mounted underneath, so search and scroll survive.
export function JournalPanel() {
  const navigate = useNavigate()
  const { key } = useLocation()
  const panelRef = useRef<HTMLDivElement>(null)

  const close = useCallback(() => {
    // Opened from the landing in this tab: step back, so the landing is exactly as it was left.
    // Opened from a link or a reload: there is nothing behind it to step back to.
    if (key === 'default') void navigate('/', { replace: true })
    else void navigate(-1)
  }, [key, navigate])

  useEffect(() => {
    // Focus goes back to whatever opened the journal, usually the patient's tile.
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null
    panelRef.current?.focus()
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close()
    }
    document.addEventListener('keydown', onKeyDown)
    // The landing behind must not scroll along with the journal.
    const root = document.documentElement
    const previousOverflow = root.style.overflow
    root.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      root.style.overflow = previousOverflow
      if (opener?.isConnected) opener.focus({ preventScroll: true })
    }
  }, [close])

  return (
    <div
      ref={panelRef}
      className={styles.panel}
      role="dialog"
      aria-modal="true"
      aria-labelledby={JOURNAL_TITLE_ID}
      tabIndex={-1}
    >
      <div className={styles.sheet}>
        <button type="button" className={styles.close} onClick={close} aria-label="Close journal">
          <span aria-hidden="true">×</span>
        </button>
        <JournalPage />
      </div>
    </div>
  )
}
