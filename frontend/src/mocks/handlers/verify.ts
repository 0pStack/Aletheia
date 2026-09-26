import { http, HttpResponse } from 'msw'
import type { EventProof } from '../../api/schemas'
import { mockAccessLog, STAFF_ROLES } from '../data'
import { getCurrentSessionUser } from '../sessionState'
import { badRequest, forbidden, notFound, unauthenticated } from './authGuard'
import { paramId } from './params'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/

// The mock has no chain to hash, so every known event proves valid. The fixed hashes are
// only there to satisfy the shape; the real endpoint derives them from the block.
function mockProof(eventId: string, blockIndex: number): EventProof {
  return {
    eventId,
    blockIndex,
    blockHash: blockIndex.toString(16).padStart(64, '0'),
    merkleRoot: 'f'.repeat(64),
    proof: [],
    isValid: true,
  }
}

export const verifyHandlers = [
  http.get('*/api/verify/:eventId', ({ params }) => {
    const user = getCurrentSessionUser()
    if (!user) return unauthenticated()
    if (!STAFF_ROLES.includes(user.role) && user.role !== 'PATIENT') return forbidden()

    const eventId = paramId(params.eventId)
    if (!UUID.test(eventId)) return badRequest('A valid event id is required.')

    // Another patient's event answers like a missing one, so ids cannot be probed.
    const entry = mockAccessLog.find((candidate) => candidate.eventId === eventId)
    if (!entry || (user.role === 'PATIENT' && entry.patientId !== user.patientId)) {
      return notFound('Event not found.')
    }

    return HttpResponse.json({
      success: true,
      data: mockProof(entry.eventId, entry.blockIndex),
      error: null,
    })
  }),
]
