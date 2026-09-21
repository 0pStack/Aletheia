import { http, HttpResponse } from 'msw'
import { mockNotes, mockPatients, type MockNote, type MockUser } from '../data'
import { badRequest, notFound, requirePatientViewAccess, requireStaffAccess } from './authGuard'
import { numericParamId } from './params'

// A PATIENT only sees ALL-visibility notes. Staff see STAFF and ALL notes,
// plus PRIVATE notes they authored themselves.
function visibleNotes(patientId: number, viewer: MockUser): readonly MockNote[] {
  const notesForPatient = mockNotes.filter((note) => note.patientId === patientId)

  if (viewer.role === 'PATIENT') {
    return notesForPatient.filter((note) => note.visibility === 'ALL')
  }

  return notesForPatient.filter(
    (note) => note.visibility !== 'PRIVATE' || note.authorId === viewer.id,
  )
}

export const patientHandlers = [
  http.get('*/api/patients', ({ request }) => {
    const guard = requireStaffAccess()
    if (!guard.ok) return guard.response

    const query = new URL(request.url).searchParams.get('q')?.trim().toLowerCase() ?? ''
    // Matches the backend: an empty query is refused rather than listing every patient.
    if (query === '') return badRequest('A search query is required.')

    const digits = query.replace(/\D/g, '')
    const results = mockPatients.filter(
      (patient) =>
        patient.name.toLowerCase().includes(query) ||
        (digits !== '' && patient.personalNumber.replace(/-/g, '').includes(digits)),
    )

    return HttpResponse.json({ success: true, data: results, error: null })
  }),

  http.get('*/api/patients/:id', ({ params }) => {
    const patientId = numericParamId(params.id)
    const guard = requirePatientViewAccess(patientId)
    if (!guard.ok) return guard.response

    const patient = mockPatients.find((candidate) => candidate.id === patientId)
    if (!patient) return notFound()

    const notes = visibleNotes(patientId, guard.user)
    return HttpResponse.json({ success: true, data: { patient, notes }, error: null })
  }),
]
