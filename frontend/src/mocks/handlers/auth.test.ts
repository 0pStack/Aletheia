import { afterEach, describe, expect, it } from 'vitest'
import { z } from 'zod'
import { sessionUserSchema } from '../../api/schemas'
import { ApiError, request } from '../../api/http'
import { resetMockSession } from '../sessionState'

const logoutResultSchema = z.object({ ok: z.boolean() })

afterEach(() => {
  resetMockSession()
})

function login(username: string, password: string) {
  return request('/api/auth/login', sessionUserSchema, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  })
}

function logout() {
  return request('/api/auth/logout', logoutResultSchema, { method: 'POST' })
}

describe('POST /api/auth/login', () => {
  it('returns the session user for valid credentials', async () => {
    const user = await login('dr.berg', 'hunter2')

    expect(user).toEqual({ id: 'u1', name: 'Dr. Berg', role: 'clinician' })
  })

  it('rejects an unknown username with 401', async () => {
    const error: unknown = await login('nobody', 'hunter2').catch((caught: unknown) => caught)

    expect(error).toBeInstanceOf(ApiError)
    expect(error).toMatchObject({ status: 401 })
  })

  it('rejects a wrong password with 401', async () => {
    const error: unknown = await login('dr.berg', 'wrong-password').catch(
      (caught: unknown) => caught,
    )

    expect(error).toBeInstanceOf(ApiError)
    expect(error).toMatchObject({ status: 401 })
  })

  it.each([
    ['invalid JSON', 'not-json'],
    ['missing fields', JSON.stringify({ username: 'dr.berg' })],
  ])('rejects a body with %s with 400', async (_label, body) => {
    const error: unknown = await request('/api/auth/login', sessionUserSchema, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
    }).catch((caught: unknown) => caught)

    expect(error).toBeInstanceOf(ApiError)
    expect(error).toMatchObject({ status: 400 })
  })
})

describe('GET /api/auth/session', () => {
  it('is 401 before any login, matching the current default mock', async () => {
    const error: unknown = await request('/api/auth/session', sessionUserSchema).catch(
      (caught: unknown) => caught,
    )

    expect(error).toBeInstanceOf(ApiError)
    expect(error).toMatchObject({ status: 401 })
  })

  it('returns the logged-in user after a successful login', async () => {
    await login('n.svensson', 'hunter2')

    const user = await request('/api/auth/session', sessionUserSchema)

    expect(user).toEqual({ id: 'u2', name: 'Nurse Svensson', role: 'clinician' })
  })
})

describe('POST /api/auth/logout', () => {
  it('clears the session so a later session check is 401 again', async () => {
    await login('dr.berg', 'hunter2')

    await logout()

    const error: unknown = await request('/api/auth/session', sessionUserSchema).catch(
      (caught: unknown) => caught,
    )
    expect(error).toBeInstanceOf(ApiError)
    expect(error).toMatchObject({ status: 401 })
  })
})
