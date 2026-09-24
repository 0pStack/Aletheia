import { useQueryClient } from '@tanstack/react-query'
import { useRef } from 'react'
import { useNavigate } from 'react-router'
import { queryKeys } from '../../api/queryKeys'
import { sessionUserSchema } from '../../api/schemas'
import { DIVE_ARRIVAL_STATE } from './arrival'
import { IridescentHero } from './IridescentHero'
import { LoginForm } from './LoginForm'
import styles from './LoginPage.module.css'
import { useDive } from './useDive'
import { usePointerGlow } from './usePointerGlow'

// A patient has one record to read, so signing in takes them to it rather than asking them
// to click through a scene built for people who have to choose a patient. The journal opens
// over the landing, so the dive still arrives at the scenery it was flying into.
function arrivalPathFor(cached: unknown): string {
  const user = sessionUserSchema.safeParse(cached)
  if (!user.success) return '/'

  const { role, patientId } = user.data
  return role === 'PATIENT' && patientId !== null ? `/patients/${patientId}` : '/'
}

export function LoginPage() {
  const panelRef = useRef<HTMLDivElement>(null)
  usePointerGlow(panelRef)
  const navigate = useNavigate()
  // Read from the cache rather than subscribing: the login page sits outside the auth
  // guard, and a session query here would fire a request that is answered with a 401.
  const queryClient = useQueryClient()
  const dive = useDive(
    () =>
      void navigate(arrivalPathFor(queryClient.getQueryData(queryKeys.session)), {
        replace: true,
        state: DIVE_ARRIVAL_STATE,
      }),
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
