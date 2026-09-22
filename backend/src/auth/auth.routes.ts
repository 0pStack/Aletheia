import type { Database as DatabaseType } from 'better-sqlite3'
import { Router } from 'express'
import { findUserByUsername, toSessionUser, verifyPassword } from './auth.js'
import { fail, ok } from '../envelope.js'

export function createAuthRouter(db: DatabaseType): Router {
  const router = Router()

  router.post('/login', (req, res) => {
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

    const user = toSessionUser(row)
    req.session.user = user

    return ok(res, { user })
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
