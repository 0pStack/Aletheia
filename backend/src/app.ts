import type { Database as DatabaseType } from 'better-sqlite3'
import express, { type Express, type NextFunction, type Request, type Response } from 'express'
import session from 'express-session'
import { createAccessLogRouter } from './access-log/access-log.routes.js'
import { createAuthRouter } from './auth/auth.routes.js'
import { Blockchain } from './chain/blockchain.js'
import { db as defaultDb } from './db.js'
import { createNotesRouter } from './notes/notes.routes.js'
import { createPatientsRouter } from './patients/patients.routes.js'

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
}

export function createApp(options: CreateAppOptions = {}): Express {
  const db = options.db ?? defaultDb
  const blockchain = options.blockchain ?? new Blockchain()
  const app = express()

  app.use(express.json())

  app.use(
    session({
      secret: process.env.SESSION_SECRET ?? 'dev-only-insecure-secret',
      resave: false,
      saveUninitialized: false,
      cookie: {
        httpOnly: true,
        sameSite: 'lax',
        secure: false,
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

  app.use('/api/auth', createAuthRouter(db))
  app.use('/api/patients', createNotesRouter(db, blockchain))
  app.use('/api/patients', createAccessLogRouter(db, blockchain))
  app.use('/api/patients', createPatientsRouter(db, blockchain))

  // Last, so it sees anything the routes above throw.
  app.use(envelopeErrors)

  return app
}
