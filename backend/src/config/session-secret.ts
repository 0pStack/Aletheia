import { randomBytes } from 'node:crypto'

export interface SessionSecretOptions {
  readonly production?: boolean
}

// A fixed fallback would be public, and anyone reading the repo could sign a session
// cookie with it. Outside production a fresh random secret per start is fine: sessions
// are stored in the database, but their cookies simply stop verifying after a restart.
// Production has to keep users signed in across restarts, so it must be given one.
export function resolveSessionSecret(
  rawSecret: string | undefined,
  options: SessionSecretOptions = {},
): string {
  const trimmed = rawSecret?.trim()
  if (trimmed) return trimmed

  if (options.production) {
    throw new Error('SESSION_SECRET must be set in production')
  }

  return randomBytes(32).toString('hex')
}
