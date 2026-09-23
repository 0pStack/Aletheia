import { Link, Navigate, useParams } from 'react-router'
import { ApiError } from '../../api/http'
import { AccessLog } from '../access-log/AccessLog'
import { Button } from '../../shared/ui/Button/Button'
import { useSession } from '../auth/useSession'
import { getJournalAccess } from './journalAccess'
import { NoteForm } from './NoteForm'
import { NoteList } from './NoteList'
import { usePatientDetail } from './usePatientDetail'
import styles from './JournalPage.module.css'

export const JOURNAL_TITLE_ID = 'journal-title'

function parsePatientId(raw: string | undefined): number | null {
  if (raw === undefined || !/^\d+$/.test(raw)) return null
  const id = Number(raw)
  return id > 0 ? id : null
}

function PatientNotFound() {
  return (
    <>
      <h1 id={JOURNAL_TITLE_ID}>Patient not found</h1>
      <p>
        <Link to="/#patients">Back to patients</Link>
      </p>
    </>
  )
}

export function JournalPage() {
  const patientId = parsePatientId(useParams().patientId)
  const viewer = useSession().data
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
  const access = getJournalAccess(viewer, patientId)

  return (
    <article className={styles.journal}>
      <header className={styles.header}>
        <p className={styles.eyebrow}>{access.isOwnRecord ? 'Your journal' : 'Journal'}</p>
        <h1 id={JOURNAL_TITLE_ID}>{patient.name}</h1>
        <p className={styles.personalNumber}>{patient.personalNumber}</p>
      </header>

      <section aria-labelledby="notes-heading">
        <h2 id="notes-heading" className={styles.sectionHeading}>
          Notes
        </h2>
        {/* Says what this list covers for this role. The server has already left out
            everything else, so there is nothing hidden here to reveal. */}
        <p className={styles.scope}>
          {access.isStaff
            ? 'Shared and staff notes, plus private notes you wrote yourself.'
            : 'Notes your care team has shared with you.'}
        </p>
        {notes.length === 0 ? (
          <p className={styles.empty}>No notes yet.</p>
        ) : (
          <NoteList notes={notes} showVisibility={access.canSeeVisibilityLabels} />
        )}
      </section>

      <section aria-labelledby="access-log-heading">
        <h2 id="access-log-heading" className={styles.sectionHeading}>
          Who has opened this record
        </h2>
        <AccessLog patientId={patientId} />
      </section>

      {access.canWriteNotes && (
        <section aria-labelledby="write-heading">
          <h2 id="write-heading" className={styles.sectionHeading}>
            Write a note
          </h2>
          <NoteForm patientId={patientId} />
        </section>
      )}
    </article>
  )
}
