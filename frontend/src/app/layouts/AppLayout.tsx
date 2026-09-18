import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, Outlet, useLocation, useMatch, useNavigate } from 'react-router'
import { arrivedByDive } from '../../features/auth/arrival'
import { STAFF_ROLES } from '../../api/schemas'
import { useLogout } from '../../features/auth/useLogout'
import { useSession } from '../../features/auth/useSession'
import styles from './AppLayout.module.css'

const MAIN_CONTENT_ID = 'main-content'

export function AppLayout() {
  const location = useLocation()
  const navigate = useNavigate()
  const mainRef = useRef<HTMLElement>(null)
  const logout = useLogout()
  const role = useSession().data?.role
  const canSearchPatients = role !== undefined && STAFF_ROLES.includes(role)
  // The landing page owns the full viewport; every other page sits in the reading column.
  const fullBleed = useMatch('/') !== null || undefined
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
      <a href={`#${MAIN_CONTENT_ID}`} className={styles.skipLink}>
        Skip to content
      </a>
      <header className={styles.header} data-settle-in={settleIn}>
        <Link to="/" className={styles.wordmark}>
          Aletheia
        </Link>
        <nav aria-label="Main" className={styles.nav}>
          {canSearchPatients && (
            <NavLink to="/patients" className={styles.navLink}>
              Patients
            </NavLink>
          )}
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
