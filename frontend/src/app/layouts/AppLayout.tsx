import { useEffect, useRef, useState } from 'react'
import { Link, Outlet, useLocation, useMatch, useNavigate } from 'react-router'
import { arrivedByDive } from '../../features/auth/arrival'
import { useLogout } from '../../features/auth/useLogout'
import styles from './AppLayout.module.css'

const MAIN_CONTENT_ID = 'main-content'

export function AppLayout() {
  const location = useLocation()
  const navigate = useNavigate()
  const mainRef = useRef<HTMLElement>(null)
  const logout = useLogout()
  // The landing page owns the full viewport; every other page sits in the reading column.
  const onLanding = useMatch('/') !== null
  const onJournal = useMatch('/patients/:patientId') !== null
  const fullBleed = onLanding || onJournal || undefined
  // Captured once: the flag is cleared from history below, and the animation must outlive that.
  const [settleIn] = useState(() => arrivedByDive(location.state) || undefined)

  useEffect(() => {
    if (!settleIn) return
    // The login page is gone, so put keyboard and screen-reader focus on the content.
    // preventScroll: focusing a tall <main> would otherwise scroll the header out of view.
    mainRef.current?.focus({ preventScroll: true })
    // history.state survives reloads and Back; without this the settle-in would replay each time.
    void navigate(`${location.pathname}${location.search}`, { replace: true, state: null })
    // Arrival is a one-off: later location changes must not re-run this.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <>
      <a href={`#${MAIN_CONTENT_ID}`} className={styles.skipLink} inert={onJournal}>
        Skip to content
      </a>
      {/* The journal is a modal over the page, so the header is out of reach while it is open. */}
      <header
        className={styles.header}
        data-settle-in={settleIn}
        data-over-scene={fullBleed}
        inert={onJournal}
      >
        <Link to="/" className={styles.wordmark}>
          Aletheia
        </Link>
        <nav aria-label="Main" className={styles.nav}>
          {/* Search is one step from the landing's own action; the team is at the foot of the page. */}
          <Link to="/#team" className={styles.navLink}>
            Team
          </Link>
          <button type="button" className={styles.navLink} onClick={() => logout.mutate()}>
            Sign out
          </button>
        </nav>
      </header>
      <main
        ref={mainRef}
        id={MAIN_CONTENT_ID}
        tabIndex={-1}
        className={styles.main}
        data-settle-in={settleIn}
        data-full-bleed={fullBleed}
      >
        <Outlet />
      </main>
    </>
  )
}
