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

  it('rejects a user with a role that is not allowed', () => {
    const req = {
      session: {
        user: {
          id: 2,
          username: 'patient',
          name: 'Patient',
          role: 'PATIENT',
          patientId: 1,
        },
      },
    } as Request

    const json = vi.fn()
    const status = vi.fn(() => ({ json }))

    const res = {
      status,
    } as unknown as Response

    const next = vi.fn() as NextFunction

    requireRole('DOCTOR', 'NURSE')(req, res, next)

    expect(status).toHaveBeenCalledWith(403)
    expect(json).toHaveBeenCalledWith({
      success: false,
      data: null,
      error: {
        code: 'FORBIDDEN',
        message: 'You do not have permission to access this resource.',
      },
    })
    expect(next).not.toHaveBeenCalled()
  })

  it('rejects a user who is not authenticated', () => {
    const req = {
      session: {},
    } as Request

    const json = vi.fn()
    const status = vi.fn(() => ({ json }))

    const res = {
      status,
    } as unknown as Response

    const next = vi.fn() as NextFunction

    requireRole('DOCTOR')(req, res, next)

    expect(status).toHaveBeenCalledWith(401)
    expect(json).toHaveBeenCalledWith({
      success: false,
      data: null,
      error: {
        code: 'UNAUTHENTICATED',
        message: 'Authentication required.',
      },
    })
    expect(next).not.toHaveBeenCalled()
  })
})
