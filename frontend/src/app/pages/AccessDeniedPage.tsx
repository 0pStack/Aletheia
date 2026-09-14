import { Link } from 'react-router'

export function AccessDeniedPage() {
  return (
    <main>
      <h1>Access denied</h1>
      <p>
        You do not have permission to view this record. <Link to="/patients">Back to patients</Link>
      </p>
    </main>
  )
}
