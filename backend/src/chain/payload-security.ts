import type { Block } from './block.js'

const ALLOWED_ACCESS_EVENT_FIELDS = new Set([
  'id',
  'patientId',
  'userId',
  'role',
  'action',
  'timestamp',
  'serverId',
  'signature',
  'publicKey',
])

export function hasOnlyAllowedAccessEventFields(event: object): boolean {
  return Object.keys(event).every((field) => ALLOWED_ACCESS_EVENT_FIELDS.has(field))
}

export function hasOnlyAllowedBlockchainPayloadFields(blocks: Block[]): boolean {
  return blocks.every((block) =>
    block.data.every((event) => hasOnlyAllowedAccessEventFields(event)),
  )
}
