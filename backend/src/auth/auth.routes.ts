import type { Database as DatabaseType } from 'better-sqlite3'
import { Router } from 'express'
import { ipKeyGenerator, rateLimit } from 'express-rate-limit'
import { findUserByUsername, toSessionUser, verifyPassword } from './auth.js'
import { fail, ok } from '../envelope.js'

export const LOGIN_ATTEMPT_LIMIT = 10
const LOGIN_ATTEMPT_WINDOW_MS = 15 * 60 * 1000

function loginUsername(body: unknown): string {
  if (typeof body !== 'object' || body === null) return ''
  const { username } = body as { username?: unknown }
  return typeof username === 'string' ? username.trim() : ''
}

export function createAuthRouter(db: DatabaseType): Router {
  const router = Router()

  // Counted per address and username: behind the dev proxy every request comes from
  // localhost, so an address alone would let one person's typos lock out everyone.
  // Only a wrong password counts; a malformed request is not a guess.
  const loginLimiter = rateLimit({
    windowMs: LOGIN_ATTEMPT_WINDOW_MS,
    limit: LOGIN_ATTEMPT_LIMIT,
    keyGenerator: (req) => `${ipKeyGenerator(req.ip ?? '')}:${loginUsername(req.body)}`,
    skipSuccessfulRequests: true,
    requestWasSuccessful: (_req, res) => res.statusCode !== 401,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    handler: (_req, res) => {
      fail(res, 429, 'RATE_LIMITED', 'Too many login attempts. Try again later.')
    },
  })

  router.post('/login', loginLimiter, (req, res) => {
    const body: unknown = req.body
    const { username, password } =
      typeof body === 'object' && body !== null
        ? (body as { username?: unknown; password?: unknown })
        : {}

    if (
      typeof username !== 'string' ||
      typeof password !== 'string' ||
      username.trim() === '' ||
      password === ''
    ) {
      return fail(res, 400, 'BAD_REQUEST', 'Username and password are required.')
    }

    const row = findUserByUsername(db, username.trim())

    if (!row || !verifyPassword(password, row.password_hash)) {
      return fail(res, 401, 'INVALID_CREDENTIALS', 'Wrong username or password.')
    }

    // A fresh session id on login, so an id planted before sign-in is never promoted
    // to an authenticated one.
    req.session.regenerate((err) => {
      if (err) {
        console.error(err)
        fail(res, 500, 'INTERNAL_ERROR', 'Could not start the session.')
        return
      }

      const user = toSessionUser(row)
      req.session.user = user
      ok(res, { user })
    })
  })

  router.post('/logout', (req, res) => {
    if (!req.session.user) {
      return fail(res, 401, 'UNAUTHENTICATED', 'No active session.')
    }

    req.session.destroy((err) => {
      if (err) {
        console.error(err)
        fail(res, 500, 'INTERNAL_ERROR', 'Could not end the session.')
        return
      }

      res.clearCookie('connect.sid')
      ok(res, { message: 'Logged out successfully' })
    })
  })

  router.get('/session', (req, res) => {
    const user = req.session.user

    if (!user) {
      return fail(res, 401, 'UNAUTHENTICATED', 'No active session.')
    }

    return ok(res, user)
  })

  return router
}
