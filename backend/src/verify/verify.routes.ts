import { Router } from 'express'
import type { Blockchain } from '../chain/blockchain.js'
import { fail, ok } from '../envelope.js'
import { requireRole } from '../rbac.js'
import { findEventProof } from './verify.js'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function createVerifyRouter(blockchain: Blockchain): Router {
  const router = Router()

  router.get('/:eventId', requireRole('DOCTOR', 'NURSE', 'CLINIC', 'PATIENT'), (req, res) => {
    const user = req.session.user
    const { eventId } = req.params

    if (!user || typeof eventId !== 'string' || !UUID.test(eventId)) {
      return fail(res, 400, 'BAD_REQUEST', 'A valid event id is required.')
    }

    const lookup = findEventProof(blockchain, eventId)

    // Someone else's event answers exactly like a missing one, so a patient cannot learn
    // which event ids exist in other records.
    if (
      lookup.status === 'missing' ||
      (user.role === 'PATIENT' && lookup.patientId !== user.patientId)
    ) {
      return fail(res, 404, 'NOT_FOUND', 'Event not found.')
    }

    if (lookup.status === 'pending') {
      return fail(res, 409, 'PENDING', 'The event is waiting to be sealed into a block.')
    }

    // Like reading the access log, checking a proof is not itself logged.
    return ok(res, lookup.proof)
  })

  return router
}
