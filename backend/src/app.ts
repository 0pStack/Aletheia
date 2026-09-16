import express, { type Express } from 'express'

export function createApp(): Express {
  const app = express()

  app.get('/api/health', (_req, res) => {
    res.json({ success: true, data: { status: 'ok' }, error: null })
  })

  return app
}
