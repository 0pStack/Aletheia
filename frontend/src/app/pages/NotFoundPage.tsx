import { Link } from 'react-router'

export function NotFoundPage() {
  return (
    <>
      <h1>Page not found</h1>
      <p>
        <Link to="/patients">Back to patients</Link>
      </p>
    </>
  )
}
