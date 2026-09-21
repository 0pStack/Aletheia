import { Link, Navigate, useParams } from 'react-router'
import { ApiError } from '../../api/http'
import { Button } from '../../shared/ui/Button/Button'
import { NoteList } from './NoteList'
import { usePatientDetail } from './usePatientDetail'
import styles from './JournalPage.module.css'

function parsePatientId(raw: string | undefined): number | null {
  if (raw === undefined || !/^\d+$/.test(raw)) return null
  const id = Number(raw)
  return id > 0 ? id : null
}

function PatientNotFound() {
  return (
    <>
      <h1>Patient not found</h1>
      <p>
        <Link to="/#patients">Back to patients</Link>
      </p>
    </>
  )
}

export function JournalPage() {
  const patientId = parsePatientId(useParams().patientId)
  const detail = usePatientDetail(patientId)

  if (patientId === null) return <PatientNotFound />

  if (detail.isPending) {
    return <p role="status">Loading journal…</p>
  }

  if (detail.isError) {
    const status = detail.error instanceof ApiError ? detail.error.status : null
    if (status === 403) return <Navigate to="/access-denied" replace />
    if (status === 404) return <PatientNotFound />
    return (
      <div className={styles.state}>
        <p role="alert">{detail.error.message}</p>
        <Button onClick={() => void detail.refetch()} disabled={detail.isFetching}>
          Try again
        </Button>
      </div>
    )
  }

  const { patient, notes } = detail.data

  return (
    <article className={styles.journal}>
      <header className={styles.header}>
        <p className={styles.eyebrow}>Journal</p>
        <h1>{patient.name}</h1>
        <p className={styles.personalNumber}>{patient.personalNumber}</p>
      </header>

      <section aria-labelledby="notes-heading">
        <h2 id="notes-heading" className={styles.sectionHeading}>
          Notes
        </h2>
        {notes.length === 0 ? (
          <p className={styles.empty}>No notes yet.</p>
        ) : (
          <NoteList notes={notes} />
        )}
      </section>
    </article>
  )
}
