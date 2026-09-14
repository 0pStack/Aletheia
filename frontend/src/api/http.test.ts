import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { server } from '../mocks/server'
import { ApiError, request } from './http'

const okSchema = z.object({ ok: z.boolean() })

function captureRequestHeaders() {
  const captured: { headers: Headers | null } = { headers: null }
  server.use(
    http.get('*/api/echo', ({ request: incoming }) => {
      captured.headers = incoming.headers
      return HttpResponse.json({ success: true, data: { ok: true }, error: null })
    }),
  )
  return captured
}

describe('request', () => {
  it('keeps headers passed as a Headers instance', async () => {
    const captured = captureRequestHeaders()

    await request('/api/echo', okSchema, { headers: new Headers({ 'X-Trace': 'abc' }) })

    expect(captured.headers?.get('X-Trace')).toBe('abc')
    expect(captured.headers?.get('Accept')).toBe('application/json')
  })

  it('keeps the original network error as the cause', async () => {
    server.use(http.get('*/api/echo', () => HttpResponse.error()))

    const error: unknown = await request('/api/echo', okSchema).catch((caught: unknown) => caught)

    expect(error).toBeInstanceOf(ApiError)
    expect(error).toMatchObject({ status: 0, cause: expect.any(Error) })
  })

  it('keeps the JSON parse error as the cause for a non-JSON body', async () => {
    server.use(http.get('*/api/echo', () => HttpResponse.text('<html>502</html>', { status: 502 })))

    const error: unknown = await request('/api/echo', okSchema).catch((caught: unknown) => caught)

    expect(error).toMatchObject({ status: 502, cause: expect.any(Error) })
  })
})
