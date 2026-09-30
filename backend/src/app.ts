import type { Database as DatabaseType } from 'better-sqlite3'
import express, { type Express, type NextFunction, type Request, type Response } from 'express'
import session from 'express-session'
import { createAccessLogRouter } from './access-log/access-log.routes.js'
import { createAuthRouter } from './auth/auth.routes.js'
import { Blockchain } from './chain/blockchain.js'
import type { KeyPair } from './chain/keypair.js'
import { SqliteSessionStore } from './auth/sqlite-session-store.js'
import { resolveSecureCookie } from './config/session-cookie.js'
import { resolveSessionSecret } from './config/session-secret.js'
import { resolveTrustProxy } from './config/trust-proxy.js'
import { db as defaultDb } from './db.js'
import { ok } from './envelope.js'
import { createNotesRouter } from './notes/notes.routes.js'
import { createPatientsRouter } from './patients/patients.routes.js'
import { createVerifyRouter } from './verify/verify.routes.js'

// Express answers an unhandled throw with an HTML page carrying the stack. Every client
// here parses the envelope, and the underlying message may name database internals, so
// the detail is logged on the server and the client is told only that it failed.
export function envelopeErrors(
  error: unknown,
  _req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (res.headersSent) return next(error)
  console.error('Unhandled error:', error)
  res.status(500).json({
    success: false,
    data: null,
    error: { code: 'INTERNAL', message: 'Something went wrong.' },
  })
}

export interface CreateAppOptions {
  db?: DatabaseType
  blockchain?: Blockchain
  keyPair: KeyPair
  sessionCookieName?: string
}

export function createApp(options: CreateAppOptions): Express {
  const db = options.db ?? defaultDb
  const blockchain = options.blockchain ?? new Blockchain()
  const sessionCookieName = options.sessionCookieName ?? 'connect.sid'
  const app = express()
  // requireRole records refused attempts, and reaches the chain, the patients and the
  // signing key through here, without every route having to pass them in.
  app.locals.blockchain = blockchain
  app.locals.db = db
  app.locals.keyPair = options.keyPair

  app.set('trust proxy', resolveTrustProxy(process.env.TRUST_PROXY))
  app.use(express.json())

  const sessionSecret = resolveSessionSecret(process.env.SESSION_SECRET, {
    production: process.env.NODE_ENV === 'production',
  })

  app.use(
    session({
      name: sessionCookieName,
      // Both local nodes read one sessions table, so each signs with its own key; a
      // cookie from one node, renamed, does not verify on the other.
      secret: `${sessionSecret}:${sessionCookieName}`,
      store: new SqliteSessionStore(db),
      resave: false,
      saveUninitialized: false,
      cookie: {
        httpOnly: true,
        sameSite: 'lax',
        secure: resolveSecureCookie(process.env),
        maxAge: 8 * 60 * 60 * 1000,
      },
    }),
  )

  app.get('/api/health', (_req, res) => {
    res.json({
      success: true,
      data: { status: 'ok' },
      error: null,
    })
  })

  app.get('/api/chain/status', (_req, res) => {
    const firstInvalidBlockIndex = blockchain.findFirstInvalidBlockIndex()

    return ok(res, {
      valid: firstInvalidBlockIndex === null,
      firstInvalidBlockIndex,
    })
  })

  app.use('/api/auth', createAuthRouter(db, sessionCookieName))
  app.use('/api/patients', createNotesRouter(db, blockchain, options.keyPair))
  app.use('/api/patients', createAccessLogRouter(db, blockchain, options.keyPair))
  app.use('/api/patients', createPatientsRouter(db, blockchain, options.keyPair))
  app.use('/api/verify', createVerifyRouter(blockchain))

  // Last, so it sees anything the routes above throw.
  app.use(envelopeErrors)

  return app
}
