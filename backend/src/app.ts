import type { Database as DatabaseType } from 'better-sqlite3'
import express, { type Express } from 'express'
import session from 'express-session'
import { createAuthRouter } from './auth/auth.routes.js'
import { Blockchain } from './chain/blockchain.js'
import { db as defaultDb } from './db.js'
import { createNotesRouter } from './notes/notes.routes.js'
import { createPatientsRouter } from './patients/patients.routes.js'

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
  app.use('/api/patients', createPatientsRouter(db))

  return app
}
