import { http, HttpResponse } from 'msw'
import { mockAccessLog, mockPatients } from '../data'
import { requirePatientDataAccess } from './authGuard'
import { paramId } from './params'

export const accessLogHandlers = [
  http.get('*/api/patients/:id/access-log', ({ params }) => {
    const guard = requirePatientDataAccess()
    if (!guard.ok) return guard.response

    const patientId = paramId(params.id)
    const patientExists = mockPatients.some((patient) => patient.id === patientId)
    if (!patientExists) {
      return HttpResponse.json(
        { success: false, data: null, error: 'Patient not found' },
        { status: 404 },
      )
    }

    const entries = mockAccessLog.filter((entry) => entry.patientId === patientId)
    return HttpResponse.json({ success: true, data: entries, error: null })
  }),
]
