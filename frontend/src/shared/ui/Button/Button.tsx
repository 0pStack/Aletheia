import type { ButtonHTMLAttributes } from 'react'
import styles from './Button.module.css'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'outline' | 'solid'
}

export function Button({ className, type = 'button', variant = 'outline', ...props }: ButtonProps) {
  const classes = [styles.button, variant === 'solid' ? styles.solid : '', className ?? '']
    .filter(Boolean)
    .join(' ')
  return <button type={type} className={classes} {...props} />
}
