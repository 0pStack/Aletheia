import { describe, expect, it, vi } from 'vitest'
import type { NextFunction, Request, Response } from 'express'
import { requireRole } from './rbac.js'

describe('requireRole', () => {
  it('allows a user with an allowed role', () => {
    const req = {
      session: {
        user: {
          id: 1,
          username: 'doctor',
          name: 'Doctor',
          role: 'DOCTOR',
          patientId: null,
        },
      },
    } as Request

    const json = vi.fn()
    const status = vi.fn(() => ({ json }))

    const res = {
      status,
    } as unknown as Response

    const next = vi.fn() as NextFunction

    requireRole('DOCTOR')(req, res, next)

    expect(next).toHaveBeenCalledOnce()
    expect(status).not.toHaveBeenCalled()
  })
})
