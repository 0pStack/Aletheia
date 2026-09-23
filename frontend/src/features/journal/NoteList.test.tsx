import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { Note, NoteVisibility } from '../../api/schemas'
import { NoteList } from './NoteList'

function note(id: number, visibility: NoteVisibility): Note {
  return {
    redacted: false,
    id,
    authorId: 1,
    authorName: 'Dr. Gregory House',
    authorRole: 'DOCTOR',
    text: `Note ${id}`,
    visibility,
    createdAt: '2026-01-10T09:00:00.000Z',
  }
}

const everyVisibility: readonly Note[] = [note(1, 'ALL'), note(2, 'STAFF'), note(3, 'PRIVATE')]

const restricted: Note = {
  id: 9,
  authorId: 1,
  authorName: 'Dr. Gregory House',
  authorRole: 'DOCTOR',
  visibility: 'PRIVATE',
  createdAt: '2026-01-10T09:00:00.000Z',
  redacted: true,
}

describe('NoteList', () => {
  it('labels each note for a viewer allowed to see visibility', () => {
    render(<NoteList notes={everyVisibility} showVisibility />)

    expect(screen.getByText('Visible to patient')).toBeInTheDocument()
    expect(screen.getByText('Staff only')).toBeInTheDocument()
    expect(screen.getByText('Private')).toBeInTheDocument()
  })

  // The guard lives here as well as in getJournalAccess, so a caller that wires the
  // flag wrongly still cannot label notes for someone who has no use for the levels.
  it('labels nothing when the viewer may not see visibility, whatever the levels are', () => {
    render(<NoteList notes={everyVisibility} showVisibility={false} />)

    for (const label of ['Visible to patient', 'Staff only', 'Private']) {
      expect(screen.queryByText(label)).not.toBeInTheDocument()
    }
    expect(screen.getAllByRole('listitem')).toHaveLength(3)
  })

  it('shows who wrote a restricted note without showing the note', () => {
    render(<NoteList notes={[restricted]} showVisibility />)

    expect(screen.getByText('Restricted')).toBeInTheDocument()
    expect(screen.getByText(/only dr\. gregory house can read it/i)).toBeInTheDocument()
    // The row is there, so the gap in the list is visible rather than silent.
    expect(screen.getAllByRole('listitem')).toHaveLength(1)
    expect(screen.getByText('Dr. Gregory House')).toBeInTheDocument()
  })
})
