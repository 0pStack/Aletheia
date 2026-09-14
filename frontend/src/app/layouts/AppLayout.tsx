import { Link, NavLink, Outlet } from 'react-router'
import styles from './AppLayout.module.css'

const MAIN_CONTENT_ID = 'main-content'

export function AppLayout() {
  return (
    <>
      <a href={`#${MAIN_CONTENT_ID}`} className={styles.skipLink}>
        Skip to content
      </a>
      <header className={styles.header}>
        <Link to="/patients" className={styles.wordmark}>
          Aletheia
        </Link>
        <nav aria-label="Main">
          <NavLink to="/patients" className={styles.navLink}>
            Patients
          </NavLink>
        </nav>
      </header>
      <main id={MAIN_CONTENT_ID} tabIndex={-1} className={styles.main}>
        <Outlet />
      </main>
    </>
  )
}
