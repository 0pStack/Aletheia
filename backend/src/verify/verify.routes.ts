import { Router } from 'express'
import { rateLimit } from 'express-rate-limit'
import type { Blockchain } from '../chain/blockchain.js'
import { fail, ok } from '../envelope.js'
import { requireRole } from '../rbac.js'
import { locateEvent, proveEvent } from './verify.js'

// Each proof re-checks the chain up to its block, signatures included, so one busy
// client could otherwise hold up every other request on the node.
export const VERIFY_REQUEST_LIMIT = 60
const VERIFY_WINDOW_MS = 60 * 1000

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/

export function createVerifyRouter(blockchain: Blockchain): Router {
  const router = Router()

  // Keyed on the signed-in user, who requireRole has already established.
  const verifyLimiter = rateLimit({
    windowMs: VERIFY_WINDOW_MS,
    limit: VERIFY_REQUEST_LIMIT,
    keyGenerator: (req) => `user:${req.session.user?.id ?? 'none'}`,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    handler: (_req, res) => {
      fail(res, 429, 'RATE_LIMITED', 'Too many verification requests. Try again shortly.')
    },
  })

  router.get(
    '/:eventId',
    requireRole('DOCTOR', 'NURSE', 'CLINIC', 'PATIENT'),
    verifyLimiter,
    (req, res) => {
      const user = req.session.user
      const { eventId } = req.params

      if (!user || typeof eventId !== 'string' || !UUID.test(eventId)) {
        return fail(res, 400, 'BAD_REQUEST', 'A valid event id is required.')
      }

      const location = locateEvent(blockchain, eventId)

      // Someone else's event answers exactly like a missing one, so a patient cannot learn
      // which event ids exist in other records.
      if (
        location.status === 'missing' ||
        (user.role === 'PATIENT' && location.patientId !== user.patientId)
      ) {
        return fail(res, 404, 'NOT_FOUND', 'Event not found.')
      }

      if (location.status === 'pending') {
        return fail(res, 409, 'PENDING', 'The event is waiting to be sealed into a block.')
      }

      // Like reading the access log, checking a proof is not itself logged.
      return ok(res, proveEvent(blockchain, location))
    },
  )

  return router
}
