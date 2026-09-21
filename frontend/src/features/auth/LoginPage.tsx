import { useRef } from 'react'
import { useNavigate } from 'react-router'
import { DIVE_ARRIVAL_STATE } from './arrival'
import { IridescentHero } from './IridescentHero'
import { LoginForm } from './LoginForm'
import styles from './LoginPage.module.css'
import { useDive } from './useDive'
import { usePointerGlow } from './usePointerGlow'

// Every sign-in lands on the landing scene, which is what the dive flies into; landing anywhere
// else would cut from the dive's scenery straight to a plain page.
const ARRIVAL_PATH = '/'

export function LoginPage() {
  const panelRef = useRef<HTMLDivElement>(null)
  usePointerGlow(panelRef)
  const navigate = useNavigate()
  const dive = useDive(
    () => void navigate(ARRIVAL_PATH, { replace: true, state: DIVE_ARRIVAL_STATE }),
  )

  return (
    <main className={styles.page} data-diving={dive.mode ?? undefined}>
      <h1 className={styles.visuallyHidden}>Aletheia</h1>
      <IridescentHero className={styles.hero} diving={dive.mode === 'full'} />
      <div ref={panelRef} className={styles.formPanel}>
        <h2 className={styles.heading}>Sign in</h2>
        <LoginForm onSignedIn={dive.start} />
        <p className={styles.footer}>
          Every time a record is opened, it is logged permanently. Trouble signing in? Contact your
          clinic administrator.
        </p>
      </div>
      <p role="status" className={styles.visuallyHidden}>
        {dive.mode ? 'Signed in. Opening Aletheia.' : ''}
      </p>
      <div className={styles.veil} aria-hidden="true" />
    </main>
  )
}
