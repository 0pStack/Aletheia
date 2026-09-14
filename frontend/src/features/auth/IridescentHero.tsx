import { useRef, type CSSProperties } from 'react'
import styles from './IridescentHero.module.css'
import { LiquidCanvas } from './liquid/LiquidCanvas'
import { RotatingBadge } from './RotatingBadge'
import { usePointerGlow } from './usePointerGlow'

const WORDMARK = 'Aletheia'
const LETTER_STAGGER_MS = 55

interface IridescentHeroProps {
  className?: string
}

export function IridescentHero({ className }: IridescentHeroProps) {
  const heroRef = useRef<HTMLDivElement>(null)
  usePointerGlow(heroRef)

  return (
    <div ref={heroRef} className={className ? `${styles.hero} ${className}` : styles.hero}>
      <LiquidCanvas className={styles.liquid} />
      <RotatingBadge className={styles.badge} />
      <div className={styles.text}>
        <p className={styles.wordmark} aria-hidden="true" data-wordmark>
          {[...WORDMARK].map((letter, index) => (
            <span
              key={index}
              className={styles.letter}
              style={{ '--letter-delay': `${index * LETTER_STAGGER_MS}ms` } as CSSProperties}
            >
              {letter}
            </span>
          ))}
        </p>
        <p className={styles.tagline}>Access logging for medical records</p>
      </div>
    </div>
  )
}
