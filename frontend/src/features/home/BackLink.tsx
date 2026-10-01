import { Link } from 'react-router'
import { STAFF_ROLES } from '../../api/schemas'
import { useSession } from '../auth/useSession'
import { PATIENT_SEARCH_ID } from '../patients/PatientSearch'

// Only staff have patient search on the landing; everyone else would land on a section that isn't there.
export function BackLink() {
  const role = useSession().data?.role
  const canSearch = role !== undefined && STAFF_ROLES.includes(role)

  return canSearch ? (
    <Link to={`/#${PATIENT_SEARCH_ID}`}>Back to patients</Link>
  ) : (
    <Link to="/">Back to home</Link>
  )
}
