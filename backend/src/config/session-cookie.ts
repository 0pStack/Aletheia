export interface SessionCookieEnv {
  readonly NODE_ENV?: string
  readonly SESSION_COOKIE_SECURE?: string
}

// A secure cookie is only sent over HTTPS, so it defaults on in production and off for
// local http://. A typo here would silently weaken the cookie, so anything but
// true/false is refused rather than guessed.
export function resolveSecureCookie(env: SessionCookieEnv): boolean {
  const raw = env.SESSION_COOKIE_SECURE?.trim().toLowerCase()

  if (!raw) return env.NODE_ENV === 'production'
  if (raw === 'true') return true
  if (raw === 'false') return false

  throw new Error(`SESSION_COOKIE_SECURE must be "true" or "false", got "${raw}"`)
}
