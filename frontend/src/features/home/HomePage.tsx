import { Link } from 'react-router'
import type { Role, SessionUser } from '../../api/schemas'
import { LiquidCanvas } from '../auth/liquid/LiquidCanvas'
import { useSession } from '../auth/useSession'
import styles from './HomePage.module.css'

const ROLE_LABELS: Record<Role, string> = {
  DOCTOR: 'Doctor',
  NURSE: 'Nurse',
  CLINIC: 'Clinic staff',
  PATIENT: 'Patient',
  UNAUTHORIZED: 'Awaiting access',
}

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
  return { to: '/patients', label: 'Search patients' }
}

const LOG_FACTS = [
  {
    title: 'Every opening is written down',
    body: 'Who opened a record, which record it was, and when. Reading counts, not only editing.',
  },
  {
    title: 'No single party holds the log',
    body: 'Clinics keep matching copies that are checked against each other, so an entry cannot be quietly changed or removed.',
  },
  {
    title: 'Patients can read it',
    body: 'Anyone with a record can see the full list of who has looked at it.',
  },
] as const

export function HomePage() {
  const { data: user } = useSession()
  // RequireAuth only renders this page once the session has loaded, so this never shows.
  if (!user) return null

  const destination = destinationFor(user)

  return (
    <>
      <LiquidCanvas scene="frost" className={styles.scene} />
      <section className={styles.hero} aria-labelledby="home-heading">
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
      <section className={styles.log} aria-labelledby="log-heading">
        <h2 id="log-heading" className={styles.logHeading}>
          How the access log works
        </h2>
        <ol className={styles.facts}>
          {LOG_FACTS.map((fact) => (
            <li key={fact.title} className={styles.fact}>
              <h3 className={styles.factTitle}>{fact.title}</h3>
              <p className={styles.factBody}>{fact.body}</p>
            </li>
          ))}
        </ol>
      </section>
    </>
  )
}
