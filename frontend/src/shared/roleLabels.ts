import type { Role } from '../api/schemas'

export const ROLE_LABELS: Record<Role, string> = {
  DOCTOR: 'Doctor',
  NURSE: 'Nurse',
  CLINIC: 'Clinic staff',
  PATIENT: 'Patient',
  UNAUTHORIZED: 'Awaiting access',
}
