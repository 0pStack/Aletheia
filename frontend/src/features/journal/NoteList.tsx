import type { Note, NoteVisibility } from '../../api/schemas'
import { ROLE_LABELS } from '../../shared/roleLabels'
import styles from './JournalPage.module.css'

const VISIBILITY_LABELS: Record<NoteVisibility, string> = {
  ALL: 'Visible to patient',
  STAFF: 'Staff only',
  PRIVATE: 'Private',
}

const dateFormat = new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short' })

interface NoteListProps {
  notes: readonly Note[]
  // A patient only ever receives notes shared with them, so the label would say the
  // same thing on every note and hint at a distinction they cannot act on.
  showVisibility: boolean
}

export function NoteList({ notes, showVisibility }: NoteListProps) {
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
          {showVisibility && (
            <span className={styles.visibility}>{VISIBILITY_LABELS[note.visibility]}</span>
          )}
        </li>
      ))}
    </ol>
  )
}
