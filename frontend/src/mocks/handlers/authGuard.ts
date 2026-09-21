import { HttpResponse } from 'msw'
import { STAFF_ROLES, type MockUser } from '../data'
import { getCurrentSessionUser } from '../sessionState'

type GuardResult = { ok: true; user: MockUser } | { ok: false; response: Response }

function errorResponse(status: number, code: string, message: string): Response {
  return HttpResponse.json({ success: false, data: null, error: { code, message } }, { status })
}

export function unauthenticated(): Response {
  return errorResponse(401, 'UNAUTHENTICATED', 'Not signed in')
}

export function forbidden(): Response {
  return errorResponse(403, 'FORBIDDEN', 'Not allowed for this role')
}

export function badRequest(message: string): Response {
  return errorResponse(400, 'BAD_REQUEST', message)
}

export function notFound(message = 'Patient not found'): Response {
  return errorResponse(404, 'NOT_FOUND', message)
}

// Search is staff-only; PATIENT and UNAUTHORIZED are both refused with 403.
export function requireStaffAccess(): GuardResult {
  const user = getCurrentSessionUser()
  if (!user) return { ok: false, response: unauthenticated() }
  if (!STAFF_ROLES.includes(user.role)) return { ok: false, response: forbidden() }
  return { ok: true, user }
}

// Patient detail and access-log share the same rule: staff can view any patient,
// a PATIENT can only view their own record. Checked before existence, so an
// unmatched PATIENT gets 403 rather than a 404 that would leak existence.
export function requirePatientViewAccess(patientId: number): GuardResult {
  const user = getCurrentSessionUser()
  if (!user) return { ok: false, response: unauthenticated() }
  if (STAFF_ROLES.includes(user.role)) return { ok: true, user }
  if (user.role === 'PATIENT' && user.patientId === patientId) return { ok: true, user }
  return { ok: false, response: forbidden() }
}
