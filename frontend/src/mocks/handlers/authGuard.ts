import { HttpResponse } from 'msw'
import { PATIENT_DATA_ROLES } from '../data'
import { getCurrentSessionUser } from '../sessionState'

type GuardResult = { ok: true } | { ok: false; response: Response }

function unauthorized(): Response {
  return HttpResponse.json({ success: false, data: null, error: 'Not signed in' }, { status: 401 })
}

function forbidden(): Response {
  return HttpResponse.json(
    { success: false, data: null, error: 'Not allowed for this role' },
    { status: 403 },
  )
}

export function requirePatientDataAccess(): GuardResult {
  const user = getCurrentSessionUser()
  if (!user) return { ok: false, response: unauthorized() }
  if (!PATIENT_DATA_ROLES.includes(user.role)) return { ok: false, response: forbidden() }
  return { ok: true }
}
