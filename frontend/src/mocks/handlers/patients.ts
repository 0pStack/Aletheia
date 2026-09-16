import { http, HttpResponse } from 'msw'
import { mockNotes, mockPatients } from '../data'
import { requirePatientDataAccess } from './authGuard'
import { paramId } from './params'

function notFound() {
  return HttpResponse.json(
    { success: false, data: null, error: 'Patient not found' },
    { status: 404 },
  )
}

export const patientHandlers = [
  http.get('*/api/patients', ({ request }) => {
    const guard = requirePatientDataAccess()
    if (!guard.ok) return guard.response

    const query = new URL(request.url).searchParams.get('q')?.trim().toLowerCase() ?? ''
    const results = query
      ? mockPatients.filter(
          (patient) =>
            patient.name.toLowerCase().includes(query) || patient.id.toLowerCase().includes(query),
        )
      : mockPatients

    return HttpResponse.json({ success: true, data: results, error: null })
  }),

  http.get('*/api/patients/:id', ({ params }) => {
    const guard = requirePatientDataAccess()
    if (!guard.ok) return guard.response

    const patientId = paramId(params.id)
    const patient = mockPatients.find((candidate) => candidate.id === patientId)
    if (!patient) return notFound()

    const notes = mockNotes.filter((note) => note.patientId === patientId)
    return HttpResponse.json({ success: true, data: { patient, notes }, error: null })
  }),
]
