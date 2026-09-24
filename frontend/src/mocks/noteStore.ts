import { mockNotes, type MockNote } from './data'

// Notes written during a session live here rather than in data.ts, so the seed stays a
// constant and resetNoteStore() keeps one test's note out of the next one.
let writtenNotes: readonly MockNote[] = []

export function allMockNotes(): readonly MockNote[] {
  return [...mockNotes, ...writtenNotes]
}

export function addMockNote(note: Omit<MockNote, 'id'>): MockNote {
  const nextId = Math.max(0, ...allMockNotes().map((existing) => existing.id)) + 1
  const created: MockNote = { ...note, id: nextId }
  writtenNotes = [...writtenNotes, created]
  return created
}

export function resetNoteStore(): void {
  writtenNotes = []
}
