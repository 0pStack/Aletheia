import { useRef, type FormEvent } from 'react'
import { Button } from '../../shared/ui/Button/Button'
import fields from './AuthField.module.css'
import { IridescentHero } from './IridescentHero'
import styles from './LoginPage.module.css'
import { PasswordField } from './PasswordField'
import { usePointerGlow } from './usePointerGlow'

function handleSubmit(event: FormEvent<HTMLFormElement>) {
  event.preventDefault()
}

export function LoginPage() {
  const panelRef = useRef<HTMLDivElement>(null)
  usePointerGlow(panelRef)

  return (
    <main className={styles.page}>
      <h1 className={styles.visuallyHidden}>Aletheia</h1>
      <IridescentHero className={styles.hero} />
      <div ref={panelRef} className={styles.formPanel}>
        <h2 className={styles.heading}>Sign in</h2>
        <form className={styles.form} onSubmit={handleSubmit} noValidate>
          <div className={fields.field}>
            <label htmlFor="username" className={fields.label}>
              Username
            </label>
            <span className={fields.control}>
              <input
                id="username"
                name="username"
                type="text"
                autoComplete="username"
                className={fields.input}
              />
            </span>
          </div>
          <PasswordField
            id="password"
            name="password"
            label="Password"
            autoComplete="current-password"
          />
          <Button type="submit" variant="solid" className={styles.submit}>
            Sign in
            <span className={styles.arrow} aria-hidden="true">
              →
            </span>
          </Button>
        </form>
        <p className={styles.footer}>Every record access is logged on-chain.</p>
      </div>
    </main>
  )
}
