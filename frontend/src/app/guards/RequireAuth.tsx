import { Navigate, Outlet } from 'react-router'
import { ApiError } from '../../api/http'
import { useSession } from '../../features/auth/useSession'
import { Button } from '../../shared/ui/Button/Button'
import styles from './RequireAuth.module.css'

export function RequireAuth() {
  const session = useSession()

  if (session.isPending) {
    return (
      <main className={styles.state}>
        <p role="status">Checking your session…</p>
      </main>
    )
  }

  if (session.isError) {
    if (session.error instanceof ApiError && session.error.status === 401) {
      return <Navigate to="/login" replace />
    }
    return (
      <main className={styles.state}>
        <p role="alert">{session.error.message}</p>
        <Button onClick={() => void session.refetch()} disabled={session.isFetching}>
          Try again
        </Button>
      </main>
    )
  }

  return <Outlet />
}
