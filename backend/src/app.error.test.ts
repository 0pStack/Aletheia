import express from 'express'
import request from 'supertest'
import { describe, expect, it } from 'vitest'
import { envelopeErrors } from './app.js'

describe('envelopeErrors', () => {
  it('answers an unexpected throw with the envelope instead of an HTML page', async () => {
    const app = express()
    app.get('/boom', () => {
      throw new Error('FOREIGN KEY constraint failed')
    })
    app.use(envelopeErrors)

    const res = await request(app).get('/boom')

    expect(res.status).toBe(500)
    expect(res.type).toBe('application/json')
    expect(res.body).toEqual({
      success: false,
      data: null,
      error: { code: 'INTERNAL', message: 'Something went wrong.' },
    })
    // The client must not receive the message or the stack of the underlying failure.
    expect(JSON.stringify(res.body)).not.toContain('FOREIGN KEY')
  })
})
