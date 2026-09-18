import { useRef } from 'react'
import { useLocation, useNavigate } from 'react-router'
import { z } from 'zod'
import { DIVE_ARRIVAL_STATE } from './arrival'
import { IridescentHero } from './IridescentHero'
import { LoginForm } from './LoginForm'
import styles from './LoginPage.module.css'
import { useDive } from './useDive'
import { usePointerGlow } from './usePointerGlow'

const DEFAULT_REDIRECT = '/'

// Shape RequireAuth puts in router state when it bounces a signed-out visitor.
const bouncedStateSchema = z.object({
  from: z.object({
    // App-relative only, so router state can never send a signed-in user off-site.
    pathname: z.string().refine((path) => path.startsWith('/') && !path.startsWith('//')),
    search: z.string().optional(),
    hash: z.string().optional(),
  }),
})

function readRedirectTarget(state: unknown): string {
  const bounced = bouncedStateSchema.safeParse(state)
  if (!bounced.success) return DEFAULT_REDIRECT
  const { pathname, search = '', hash = '' } = bounced.data.from
  return `${pathname}${search}${hash}`
}

export function LoginPage() {
  const panelRef = useRef<HTMLDivElement>(null)
  usePointerGlow(panelRef)
  const navigate = useNavigate()
  const redirectTarget = readRedirectTarget(useLocation().state)
  const dive = useDive(
    () => void navigate(redirectTarget, { replace: true, state: DIVE_ARRIVAL_STATE }),
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
