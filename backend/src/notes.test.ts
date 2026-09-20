import Database from 'better-sqlite3'
import { describe, expect, it } from 'vitest'
import { createNote, getVisibleNotes } from './notes.js'

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

  it('shows a STAFF note to healthcare staff but not to a patient', () => {
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
    ).run(101, 5, 'Staff medical note', 'STAFF', '2026-09-20T10:00:00.000Z')

    const doctorNotes = getVisibleNotes(db, 101, {
      id: 6,
      role: 'DOCTOR',
    })

    const nurseNotes = getVisibleNotes(db, 101, {
      id: 7,
      role: 'NURSE',
    })

    const clinicNotes = getVisibleNotes(db, 101, {
      id: 8,
      role: 'CLINIC',
    })

    const patientNotes = getVisibleNotes(db, 101, {
      id: 9,
      role: 'PATIENT',
    })

    expect(doctorNotes).toHaveLength(1)
    expect(nurseNotes).toHaveLength(1)
    expect(clinicNotes).toHaveLength(1)
    expect(patientNotes).toHaveLength(0)

    db.close()
  })

  it('shows an ALL note to healthcare staff and the patient', () => {
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
    ).run(101, 5, 'Note visible to everyone', 'ALL', '2026-09-20T10:00:00.000Z')

    const doctorNotes = getVisibleNotes(db, 101, {
      id: 6,
      role: 'DOCTOR',
    })

    const nurseNotes = getVisibleNotes(db, 101, {
      id: 7,
      role: 'NURSE',
    })

    const clinicNotes = getVisibleNotes(db, 101, {
      id: 8,
      role: 'CLINIC',
    })

    const patientNotes = getVisibleNotes(db, 101, {
      id: 9,
      role: 'PATIENT',
    })

    expect(doctorNotes).toHaveLength(1)
    expect(nurseNotes).toHaveLength(1)
    expect(clinicNotes).toHaveLength(1)
    expect(patientNotes).toHaveLength(1)

    db.close()
  })

  it('creates a PRIVATE note', () => {
    const db = new Database(':memory:')

    db.exec(`
    CREATE TABLE notes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      patient_id INTEGER NOT NULL,
      author_id INTEGER NOT NULL,
      text TEXT NOT NULL,
      visibility TEXT NOT NULL CHECK (
        visibility IN ('PRIVATE', 'STAFF', 'ALL')
      ),
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'utc'))
    )
  `)

    const note = createNote(db, {
      patientId: 101,
      authorId: 5,
      text: 'Private medical note',
      visibility: 'PRIVATE',
    })

    expect(note.patient_id).toBe(101)
    expect(note.author_id).toBe(5)
    expect(note.text).toBe('Private medical note')
    expect(note.visibility).toBe('PRIVATE')

    db.close()
  })

  it('creates notes with all three visibility levels', () => {
    const db = new Database(':memory:')

    db.exec(`
    CREATE TABLE notes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      patient_id INTEGER NOT NULL,
      author_id INTEGER NOT NULL,
      text TEXT NOT NULL,
      visibility TEXT NOT NULL CHECK (
        visibility IN ('PRIVATE', 'STAFF', 'ALL')
      ),
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'utc'))
    )
  `)

    const privateNote = createNote(db, {
      patientId: 101,
      authorId: 5,
      text: 'Private note',
      visibility: 'PRIVATE',
    })

    const staffNote = createNote(db, {
      patientId: 101,
      authorId: 5,
      text: 'Staff note',
      visibility: 'STAFF',
    })

    const allNote = createNote(db, {
      patientId: 101,
      authorId: 5,
      text: 'All note',
      visibility: 'ALL',
    })

    expect(privateNote.visibility).toBe('PRIVATE')
    expect(staffNote.visibility).toBe('STAFF')
    expect(allNote.visibility).toBe('ALL')

    db.close()
  })
})
