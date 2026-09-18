import { useRef, useState, type FormEvent } from 'react'
import { Button } from '../../shared/ui/Button/Button'
import fields from './AuthField.module.css'
import styles from './LoginPage.module.css'
import { PasswordField } from './PasswordField'
import { useLogin } from './useLogin'

const MISSING_FIELDS_MESSAGE = 'Enter your username and password.'

interface LoginFormProps {
  onSignedIn: () => void
}

function readField(data: FormData, name: string): string {
  const value = data.get(name)
  return typeof value === 'string' ? value : ''
}

function focusField(form: HTMLFormElement | null, name: string) {
  const field = form?.elements.namedItem(name)
  if (field instanceof HTMLInputElement) field.focus()
}

export function LoginForm({ onSignedIn }: LoginFormProps) {
  const login = useLogin()
  const formRef = useRef<HTMLFormElement>(null)
  const [missingFields, setMissingFields] = useState(false)
  // Stays busy after success: the page is already leaving, so a second submit must not start.
  // The button shows it with aria-disabled, because a natively disabled button drops keyboard
  // focus to <body> for the whole transition; handleSubmit is what blocks the repeat.
  const busy = login.isPending || login.isSuccess

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (busy) return

    const data = new FormData(event.currentTarget)
    const username = readField(data, 'username').trim()
    const password = readField(data, 'password')

    if (username === '' || password === '') {
      login.reset()
      setMissingFields(true)
      focusField(formRef.current, username === '' ? 'username' : 'password')
      return
    }

    setMissingFields(false)
    login.mutate(
      { username, password },
      { onSuccess: onSignedIn, onError: () => focusField(formRef.current, 'password') },
    )
  }

  const message = missingFields ? MISSING_FIELDS_MESSAGE : (login.error?.message ?? '')

  return (
    <form ref={formRef} className={styles.form} onSubmit={handleSubmit} noValidate>
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
      {/* Kept mounted so screen readers reliably announce the text when it appears. */}
      <p role="alert" className={styles.error}>
        {message}
      </p>
      <Button
        type="submit"
        variant="solid"
        className={styles.submit}
        aria-disabled={busy || undefined}
      >
        {busy ? 'Signing in…' : 'Sign in'}
        <span className={styles.arrow} aria-hidden="true">
          →
        </span>
      </Button>
    </form>
  )
}
