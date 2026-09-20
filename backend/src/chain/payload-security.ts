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
