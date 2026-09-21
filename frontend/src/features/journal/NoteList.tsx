import type { Note, NoteVisibility, Role } from '../../api/schemas'
import styles from './JournalPage.module.css'

const VISIBILITY_LABELS: Record<NoteVisibility, string> = {
  ALL: 'Visible to patient',
  STAFF: 'Staff only',
  PRIVATE: 'Private',
}

const ROLE_LABELS: Record<Role, string> = {
  DOCTOR: 'Doctor',
  NURSE: 'Nurse',
  CLINIC: 'Clinic',
  PATIENT: 'Patient',
  UNAUTHORIZED: 'Unauthorized',
}

const dateFormat = new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short' })

interface NoteListProps {
  notes: readonly Note[]
}

export function NoteList({ notes }: NoteListProps) {
  return (
    <ol className={styles.notes}>
      {notes.map((note) => (
        <li key={note.id} className={styles.note}>
          <div className={styles.noteMeta}>
            <span className={styles.author}>{note.authorName}</span>
            <span>{ROLE_LABELS[note.authorRole]}</span>
            <time dateTime={note.createdAt}>{dateFormat.format(new Date(note.createdAt))}</time>
          </div>
          <p className={styles.noteText}>{note.text}</p>
          <span className={styles.visibility}>{VISIBILITY_LABELS[note.visibility]}</span>
        </li>
      ))}
    </ol>
  )
}
