import { http, HttpResponse } from 'msw'
import { mockAccessLog, mockPatients, type MockAccessLogEntry } from '../data'
import { notFound, requirePatientViewAccess } from './authGuard'
import { numericParamId } from './params'

// The contract's AccessLogEntry has no patientId field — the patient is already
// scoped by the URL — so strip the internal patientId before returning.
function toAccessLogEntry(entry: MockAccessLogEntry) {
  return {
    eventId: entry.eventId,
    userId: entry.userId,
    userName: entry.userName,
    role: entry.role,
    action: entry.action,
    timestamp: entry.timestamp,
    serverId: entry.serverId,
    blockIndex: entry.blockIndex,
  }
}

export const accessLogHandlers = [
  http.get('*/api/patients/:id/access-log', ({ params }) => {
    const patientId = numericParamId(params.id)
    const guard = requirePatientViewAccess(patientId)
    if (!guard.ok) return guard.response

    const patientExists = mockPatients.some((patient) => patient.id === patientId)
    if (!patientExists) return notFound()

    const entries = mockAccessLog
      .filter((entry) => entry.patientId === patientId)
      .map(toAccessLogEntry)

    return HttpResponse.json({ success: true, data: entries, error: null })
  }),
]
