import { STAFF_ROLES, type SessionUser } from '../../api/schemas'

// What a viewer may do on one patient's journal. The server enforces all of this on
// every route; these flags only keep the UI from offering an action it would refuse,
// and from labelling notes a patient has no vocabulary for.
export interface JournalAccess {
  readonly isStaff: boolean
  readonly isOwnRecord: boolean
  readonly canWriteNotes: boolean
  readonly canSeeVisibilityLabels: boolean
}

const NO_ACCESS: JournalAccess = {
  isStaff: false,
  isOwnRecord: false,
  canWriteNotes: false,
  canSeeVisibilityLabels: false,
}

export function getJournalAccess(
  viewer: SessionUser | undefined,
  patientId: number | null,
): JournalAccess {
  if (viewer === undefined || patientId === null) return NO_ACCESS

  const isStaff = STAFF_ROLES.includes(viewer.role)
  const isOwnRecord = viewer.role === 'PATIENT' && viewer.patientId === patientId

  return {
    isStaff,
    isOwnRecord,
    canWriteNotes: isStaff,
    canSeeVisibilityLabels: isStaff,
  }
}
