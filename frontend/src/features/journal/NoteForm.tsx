import { useEffect, useId, useRef, useState, type FormEvent } from 'react'
import type { NoteVisibility } from '../../api/schemas'
import { Button } from '../../shared/ui/Button/Button'
import { useCreateNote } from './useCreateNote'
import styles from './JournalPage.module.css'

const EMPTY_NOTE_MESSAGE = 'Write something before saving.'

// Staff-only, so every option here is one the author may pick. STAFF is the default:
// the everyday note is for the care team, and defaulting to ALL would share with the
// patient by accident while PRIVATE would hide the note from the people treating them.
const VISIBILITY_OPTIONS: readonly { value: NoteVisibility; label: string }[] = [
  { value: 'STAFF', label: 'Staff only: everyone treating this patient' },
  { value: 'ALL', label: 'Visible to the patient as well' },
  { value: 'PRIVATE', label: 'Private: only you' },
]

interface NoteDraft {
  text: string
  visibility: NoteVisibility
}

const EMPTY_DRAFT: NoteDraft = { text: '', visibility: 'STAFF' }

interface NoteComposerProps {
  patientId: number
}

// Reading is what the journal is for, so writing waits behind one quiet line until asked.
export function NoteComposer({ patientId }: NoteComposerProps) {
  const [open, setOpen] = useState(false)
  // Cancel folds the form away without discarding it: an unsaved clinical note is not
  // something one misclick should lose.
  const [draft, setDraft] = useState<NoteDraft>(EMPTY_DRAFT)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const cancelledRef = useRef(false)

  // After Cancel the form is gone, and focus with it: put it back on the line that opened it,
  // so a keyboard user is not thrown to the top of the journal.
  useEffect(() => {
    if (!open && cancelledRef.current) {
      cancelledRef.current = false
      triggerRef.current?.focus()
    }
  }, [open])

  if (!open) {
    return (
      <button
        ref={triggerRef}
        type="button"
        className={styles.composeTrigger}
        onClick={() => setOpen(true)}
      >
        {draft.text.trim() === '' ? 'Write a note…' : 'Continue your note…'}
      </button>
    )
  }

  return (
    <NoteForm
      patientId={patientId}
      initialDraft={draft}
      onCancel={(current) => {
        cancelledRef.current = true
        setDraft(current)
        setOpen(false)
      }}
    />
  )
}

interface NoteFormProps {
  patientId: number
  initialDraft?: NoteDraft
  onCancel?: (draft: NoteDraft) => void
}

export function NoteForm({ patientId, initialDraft = EMPTY_DRAFT, onCancel }: NoteFormProps) {
  const createNote = useCreateNote(patientId)
  const textId = useId()
  const textRef = useRef<HTMLTextAreaElement>(null)
  const [text, setText] = useState(initialDraft.text)
  const [visibility, setVisibility] = useState<NoteVisibility>(initialDraft.visibility)
  const [empty, setEmpty] = useState(false)

  // Opened on request, so the cursor goes where the author is about to type.
  useEffect(() => {
    textRef.current?.focus()
  }, [])

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
      <label htmlFor={textId} className={styles.visuallyHidden}>
        New note
      </label>
      <textarea
        id={textId}
        ref={textRef}
        className={styles.noteInput}
        rows={4}
        placeholder="Write a note…"
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

      {/* Both stay mounted so a screen reader announces the text when it appears. They share
          one line of space, since only one of them ever speaks at a time. */}
      <div className={styles.noteMessages}>
        <p role="alert" className={styles.noteFormError}>
          {message}
        </p>
        <p role="status" className={styles.noteFormStatus}>
          {createNote.isSuccess && !createNote.isPending ? 'Note saved.' : ''}
        </p>
      </div>

      <div className={styles.noteActions}>
        <Button type="submit" variant="solid" aria-disabled={createNote.isPending || undefined}>
          {createNote.isPending ? 'Saving…' : 'Save note'}
        </Button>
        {onCancel && (
          <button
            type="button"
            className={styles.cancel}
            onClick={() => onCancel({ text, visibility })}
          >
            Cancel
          </button>
        )}
      </div>
    </form>
  )
}
