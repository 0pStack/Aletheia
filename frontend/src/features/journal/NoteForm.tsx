import { useId, useRef, useState, type FormEvent } from 'react'
import type { NoteVisibility } from '../../api/schemas'
import { Button } from '../../shared/ui/Button/Button'
import { useCreateNote } from './useCreateNote'
import styles from './JournalPage.module.css'

const EMPTY_NOTE_MESSAGE = 'Write something before saving.'

// Staff-only, so every option here is one the author may pick. STAFF is the default:
// the everyday note is for the care team, and defaulting to ALL would share with the
// patient by accident while PRIVATE would hide the note from the people treating them.
const VISIBILITY_OPTIONS: readonly { value: NoteVisibility; label: string }[] = [
  { value: 'STAFF', label: 'Staff only — everyone treating this patient' },
  { value: 'ALL', label: 'Visible to the patient as well' },
  { value: 'PRIVATE', label: 'Private — only you' },
]

interface NoteFormProps {
  patientId: number
}

export function NoteForm({ patientId }: NoteFormProps) {
  const createNote = useCreateNote(patientId)
  const textId = useId()
  const textRef = useRef<HTMLTextAreaElement>(null)
  const [text, setText] = useState('')
  const [visibility, setVisibility] = useState<NoteVisibility>('STAFF')
  const [empty, setEmpty] = useState(false)

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (createNote.isPending) return

    const trimmed = text.trim()
    if (trimmed === '') {
      createNote.reset()
      setEmpty(true)
      textRef.current?.focus()
      return
    }

    setEmpty(false)
    createNote.mutate(
      { text: trimmed, visibility },
      {
        // Only the text is cleared: the next note usually needs the same visibility.
        onSuccess: () => setText(''),
        onError: () => textRef.current?.focus(),
      },
    )
  }

  const message = empty ? EMPTY_NOTE_MESSAGE : (createNote.error?.message ?? '')

  return (
    <form className={styles.noteForm} onSubmit={handleSubmit} noValidate>
      <label htmlFor={textId} className={styles.sectionHeading}>
        New note
      </label>
      <textarea
        id={textId}
        ref={textRef}
        className={styles.noteInput}
        rows={4}
        value={text}
        onChange={(event) => {
          setText(event.target.value)
          // The complaint was about an empty note; typing answers it, so it goes away now
          // rather than waiting for the next submit to re-evaluate.
          setEmpty(false)
        }}
      />

      <fieldset className={styles.visibilityChoice}>
        <legend className={styles.sectionHeading}>Who can read this</legend>
        {VISIBILITY_OPTIONS.map((option) => (
          <label key={option.value} className={styles.visibilityOption}>
            <input
              type="radio"
              name="visibility"
              value={option.value}
              checked={visibility === option.value}
              onChange={() => setVisibility(option.value)}
            />
            {option.label}
          </label>
        ))}
      </fieldset>

      {/* Both stay mounted so a screen reader announces the text when it appears. */}
      <p role="alert" className={styles.noteFormError}>
        {message}
      </p>
      <p role="status" className={styles.noteFormStatus}>
        {createNote.isSuccess && !createNote.isPending ? 'Note saved.' : ''}
      </p>

      <Button type="submit" variant="solid" aria-disabled={createNote.isPending || undefined}>
        {createNote.isPending ? 'Saving…' : 'Save note'}
      </Button>
    </form>
  )
}
