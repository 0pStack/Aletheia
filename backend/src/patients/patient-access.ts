import type { Request } from 'express'
import { logAccessEvent } from '../audit-logger.js'
import type { Blockchain } from '../chain/blockchain.js'
import type { KeyPair } from '../chain/keypair.js'

export function parsePatientId(raw: unknown): number | undefined {
  const parsed = Number(raw)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined
}

// A patient may only reach their own record. The refusal is logged against the record
// they reached for; the caller answers the 403 in its own words.
export function refuseOtherPatientsRecord(
  req: Request,
  blockchain: Blockchain,
  keyPair: KeyPair,
  patientId: number,
): boolean {
  const user = req.session.user
  if (user?.role !== 'PATIENT' || user.patientId === patientId) return false

  logAccessEvent(req, blockchain, patientId, 'DENIED', keyPair)
  return true
}
