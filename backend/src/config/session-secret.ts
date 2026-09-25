import { randomBytes } from 'node:crypto'

// A fixed fallback would be public, and anyone reading the repo could sign a session
// cookie with it. Sessions live in memory and die with the process anyway, so a fresh
// random secret per start costs nothing. Set SESSION_SECRET when nodes must share one.
export function resolveSessionSecret(rawSecret: string | undefined): string {
  const trimmed = rawSecret?.trim()
  return trimmed ? trimmed : randomBytes(32).toString('hex')
}
