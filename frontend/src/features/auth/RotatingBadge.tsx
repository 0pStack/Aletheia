import styles from './RotatingBadge.module.css'

const BADGE_TEXT = 'Every access · Logged for good · '
const CIRCLE_PATH = 'M 60,60 m -46,0 a 46,46 0 1,1 92,0 a 46,46 0 1,1 -92,0'

interface RotatingBadgeProps {
  className?: string
}

export function RotatingBadge({ className }: RotatingBadgeProps) {
  return (
    <svg
      className={className ? `${styles.badge} ${className}` : styles.badge}
      viewBox="0 0 120 120"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <path id="aletheia-badge-circle" d={CIRCLE_PATH} />
      </defs>
      <g className={styles.ring}>
        <text className={styles.text}>
          <textPath href="#aletheia-badge-circle" textLength="288" lengthAdjust="spacing">
            {BADGE_TEXT}
          </textPath>
        </text>
      </g>
      <circle className={styles.dot} cx="60" cy="60" r="3" />
    </svg>
  )
}
