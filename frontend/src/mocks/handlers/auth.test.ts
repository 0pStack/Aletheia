import { afterEach, describe, expect, it } from 'vitest'
import { loginResultSchema, logoutResultSchema, sessionUserSchema } from '../../api/schemas'
import { ApiError, request } from '../../api/http'
import { resetMockSession } from '../sessionState'

afterEach(() => {
  resetMockSession()
})

function login(username: string, password: string) {
  return request('/api/auth/login', loginResultSchema, {
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
    const result = await login('doctor_dr_house', 'Password123!')

    expect(result).toEqual({
      user: {
        id: 1,
        username: 'doctor_dr_house',
        name: 'Dr. Gregory House',
        role: 'DOCTOR',
        patientId: null,
      },
    })
  })

  it('rejects an unknown username with 401 INVALID_CREDENTIALS', async () => {
    const error: unknown = await login('nobody', 'Password123!').catch((caught: unknown) => caught)

    expect(error).toBeInstanceOf(ApiError)
    expect(error).toMatchObject({ status: 401, code: 'INVALID_CREDENTIALS' })
  })

  it('rejects a wrong password with 401 INVALID_CREDENTIALS', async () => {
    const error: unknown = await login('doctor_dr_house', 'wrong-password').catch(
      (caught: unknown) => caught,
    )

    expect(error).toBeInstanceOf(ApiError)
    expect(error).toMatchObject({ status: 401, code: 'INVALID_CREDENTIALS' })
  })

  it.each([
    ['invalid JSON', 'not-json'],
    ['missing fields', JSON.stringify({ username: 'doctor_dr_house' })],
  ])('rejects a body with %s with 400 BAD_REQUEST', async (_label, body) => {
    const error: unknown = await request('/api/auth/login', loginResultSchema, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
    }).catch((caught: unknown) => caught)

    expect(error).toBeInstanceOf(ApiError)
    expect(error).toMatchObject({ status: 400, code: 'BAD_REQUEST' })
  })
})

describe('GET /api/auth/session', () => {
  it('is 401 UNAUTHENTICATED before any login', async () => {
    const error: unknown = await request('/api/auth/session', sessionUserSchema).catch(
      (caught: unknown) => caught,
    )

    expect(error).toBeInstanceOf(ApiError)
    expect(error).toMatchObject({ status: 401, code: 'UNAUTHENTICATED' })
  })

  it('returns the same-shaped user as login, after a successful login', async () => {
    await login('nurse_jackie', 'Password123!')

    const user = await request('/api/auth/session', sessionUserSchema)

    expect(user).toEqual({
      id: 2,
      username: 'nurse_jackie',
      name: 'Jackie Peyton',
      role: 'NURSE',
      patientId: null,
    })
  })
})

describe('POST /api/auth/logout', () => {
  it('returns a confirmation message', async () => {
    await login('doctor_dr_house', 'Password123!')

    const result = await logout()

    expect(result).toEqual({ message: 'Logged out successfully' })
  })

  it('clears the session so a later session check is 401 again', async () => {
    await login('doctor_dr_house', 'Password123!')

    await logout()

    const error: unknown = await request('/api/auth/session', sessionUserSchema).catch(
      (caught: unknown) => caught,
    )
    expect(error).toBeInstanceOf(ApiError)
    expect(error).toMatchObject({ status: 401, code: 'UNAUTHENTICATED' })
  })
})
