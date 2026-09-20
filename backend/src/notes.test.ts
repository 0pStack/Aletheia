import Database from 'better-sqlite3'
import { describe, expect, it } from 'vitest'
import { getVisibleNotes } from './notes.js'

describe('note visibility', () => {
  it('shows a PRIVATE note only to its author', () => {
    const db = new Database(':memory:')

    db.exec(`
      CREATE TABLE notes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        patient_id INTEGER NOT NULL,
        author_id INTEGER NOT NULL,
        text TEXT NOT NULL,
        visibility TEXT NOT NULL,
        created_at TEXT NOT NULL
      )
    `)

    db.prepare(
      `
      INSERT INTO notes (
        patient_id,
        author_id,
        text,
        visibility,
        created_at
      )
      VALUES (?, ?, ?, ?, ?)
    `,
    ).run(101, 5, 'Private medical note', 'PRIVATE', '2026-09-20T10:00:00.000Z')

    const authorNotes = getVisibleNotes(db, 101, {
      id: 5,
      role: 'DOCTOR',
    })

    const otherDoctorNotes = getVisibleNotes(db, 101, {
      id: 6,
      role: 'DOCTOR',
    })

    expect(authorNotes).toHaveLength(1)
    expect(otherDoctorNotes).toHaveLength(0)

    db.close()
  })
})
