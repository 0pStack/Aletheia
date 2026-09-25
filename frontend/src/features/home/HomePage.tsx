import { lazy, Suspense, useEffect, type ComponentType } from 'react'
import { Link, useLocation, useOutlet } from 'react-router'
import { STAFF_ROLES, type SessionUser } from '../../api/schemas'
import { allowsMotion } from '../../shared/motion/allowsMotion'
import { ROLE_LABELS } from '../../shared/roleLabels'
import { useSession } from '../auth/useSession'
import { PATIENT_SEARCH_ID, PatientSearch } from '../patients/PatientSearch'
import { TeamSection } from '../team/TeamSection'
// Type only: erased at build time, so the scene stays in its own chunk.
import type { LandingSceneProps } from './scene/LandingScene'
import markUrl from './aletheia-mark.png'
import styles from './HomePage.module.css'

// three.js is only needed here, so it stays out of the bundle the login page loads. The scene is
// scenery: if its chunk fails to load (a deploy mid-session, a dropped connection) the page must
// still work, so the failure resolves to nothing and the CSS backdrop stands in.
const LandingScene = lazy<ComponentType<LandingSceneProps>>(() =>
  import('./scene/LandingScene')
    .then((module) => ({ default: module.LandingScene }))
    .catch((error: unknown) => {
      console.error('Landing scene failed to load:', error)
      return { default: () => null }
    }),
)

interface Destination {
  to: string
  label: string
}

function destinationFor(user: SessionUser): Destination | null {
  if (user.role === 'UNAUTHORIZED') return null
  if (user.role === 'PATIENT') {
    return user.patientId === null
      ? null
      : { to: `/patients/${user.patientId}`, label: 'Open my record' }
  }
  return { to: `#${PATIENT_SEARCH_ID}`, label: 'Search patients' }
}

// What the log guarantees, in one line each: the footer states it, it does not explain it.
const LOG_FACTS = [
  'Every opening is logged',
  'No single party holds the log',
  'Patients can read who looked',
] as const

// The router does not scroll to a hash on its own, and the nav reaches search as /#patients.
// Keyed on the navigation too, so following the same link again scrolls back down.
function useScrollToHash() {
  const { hash, key } = useLocation()
  useEffect(() => {
    if (hash === '') return
    const target = document.getElementById(hash.slice(1))
    target?.scrollIntoView({ behavior: allowsMotion() ? 'smooth' : 'auto' })
    // A section can name the control a visitor arrives for, like the search field.
    target?.querySelector<HTMLElement>('[data-hash-focus]')?.focus({ preventScroll: true })
  }, [hash, key])
}

export function HomePage() {
  const { data: user } = useSession()
  useScrollToHash()
  const journal = useOutlet()
  // RequireAuth only renders this page once the session has loaded, so this never shows.
  if (!user) return null

  const destination = destinationFor(user)
  const canSearch = STAFF_ROLES.includes(user.role)

  return (
    <>
      <div className={styles.scene}>
        <Suspense fallback={null}>
          {/* Nothing of the scene is visible behind an open journal, so it stops drawing. */}
          <LandingScene paused={journal !== null} />
        </Suspense>
      </div>
      {/* While a journal is open the landing is still drawn, but out of reach. */}
      <section className={styles.hero} aria-labelledby="home-heading" inert={journal !== null}>
        <p className={styles.eyebrow}>{ROLE_LABELS[user.role]}</p>
        <h1 id="home-heading" className={styles.name}>
          {user.name}
        </h1>
        {destination ? (
          <Link to={destination.to} className={styles.action}>
            {destination.label}
            <span className={styles.arrow} aria-hidden="true">
              →
            </span>
          </Link>
        ) : (
          <p className={styles.lead}>
            Your account has no access to records yet. Contact your clinic administrator.
          </p>
        )}
      </section>
      <div className={styles.glass} inert={journal !== null}>
        {canSearch && <PatientSearch />}
        <TeamSection paused={journal !== null} />
        <footer className={styles.footer}>
          <p className={styles.footerMark}>
            <img src={markUrl} alt="" width={81} height={96} />
            Aletheia
          </p>
          <ul className={styles.footerFacts} aria-label="How the access log works">
            {LOG_FACTS.map((fact) => (
              <li key={fact}>{fact}</li>
            ))}
          </ul>
        </footer>
      </div>
      {journal}
    </>
  )
}
