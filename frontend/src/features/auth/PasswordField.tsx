import { useId, useState, type KeyboardEvent } from 'react'
import fields from './AuthField.module.css'

interface PasswordFieldProps {
  id: string
  name: string
  label: string
  autoComplete: 'current-password' | 'new-password'
}

export function PasswordField({ id, name, label, autoComplete }: PasswordFieldProps) {
  const [visible, setVisible] = useState(false)
  const [capsLockOn, setCapsLockOn] = useState(false)
  const hintId = useId()

  const syncCapsLock = (event: KeyboardEvent<HTMLInputElement>) => {
    setCapsLockOn(event.getModifierState('CapsLock'))
  }

  return (
    <div className={fields.field}>
      <label htmlFor={id} className={fields.label}>
        {label}
      </label>
      <span className={fields.control}>
        <input
          id={id}
          name={name}
          type={visible ? 'text' : 'password'}
          autoComplete={autoComplete}
          className={fields.input}
          aria-describedby={capsLockOn ? hintId : undefined}
          onKeyDown={syncCapsLock}
          onKeyUp={syncCapsLock}
          onBlur={() => setCapsLockOn(false)}
        />
        <button
          type="button"
          className={fields.toggle}
          onClick={() => setVisible((current) => !current)}
        >
          {visible ? 'Hide' : 'Show'} <span className={fields.visuallyHidden}>password</span>
        </button>
      </span>
      {/* Kept mounted so screen readers reliably announce the text when it appears. */}
      <p id={hintId} role="status" className={fields.hint}>
        {capsLockOn ? 'Caps Lock is on' : ''}
      </p>
    </div>
  )
}
