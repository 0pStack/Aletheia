import Database from 'better-sqlite3'
import { describe, expect, it } from 'vitest'
import { createNote, getVisibleNotes, toNoteResponse } from './notes.js'

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

    db.exec(`
      CREATE TABLE users (
        id INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        role TEXT NOT NULL
      )
    `)

    db.prepare('INSERT INTO users (id, name, role) VALUES (?, ?, ?)').run(5, 'Dr. Author', 'DOCTOR')

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
    expect(authorNotes[0]?.text).toBe('Private medical note')
    // Another doctor learns the note exists, but its text is never selected for them.
    expect(otherDoctorNotes).toHaveLength(1)
    expect(otherDoctorNotes[0]?.redacted).toBe(1)
    expect(otherDoctorNotes[0]?.text).toBeNull()
    expect(otherDoctorNotes[0]?.author_name).toBe('Dr. Author')

    db.close()
  })

  it('never hands a patient a stub for a note they may not read', () => {
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

    db.exec(`
      CREATE TABLE users (
        id INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        role TEXT NOT NULL
      )
    `)

    db.prepare('INSERT INTO users (id, name, role) VALUES (?, ?, ?)').run(5, 'Dr. Author', 'DOCTOR')

    for (const [text, visibility] of [
      ['Private medical note', 'PRIVATE'],
      ['Staff handover note', 'STAFF'],
    ]) {
      db.prepare(
        `INSERT INTO notes (patient_id, author_id, text, visibility, created_at)
         VALUES (?, ?, ?, ?, ?)`,
      ).run(101, 5, text, visibility, '2026-09-20T10:00:00.000Z')
    }

    // The group has not decided whether a patient should see that hidden notes exist
    // (issue #83), so until then a patient's view is unchanged: nothing at all.
    const patientNotes = getVisibleNotes(db, 101, { id: 9, role: 'PATIENT' })

    expect(patientNotes).toHaveLength(0)

    db.close()
  })

  it('maps a stub to a response with no text at all', () => {
    const readable = toNoteResponse({
      id: 1,
      patient_id: 101,
      author_id: 5,
      author_name: 'Dr. Author',
      author_role: 'DOCTOR',
      text: 'Readable',
      visibility: 'STAFF',
      created_at: '2026-09-20 10:00:00',
      redacted: 0,
    })

    const stub = toNoteResponse({
      id: 2,
      patient_id: 101,
      author_id: 5,
      author_name: 'Dr. Author',
      author_role: 'DOCTOR',
      text: null,
      visibility: 'PRIVATE',
      created_at: '2026-09-20 10:00:00',
      redacted: 1,
    })

    expect(readable).toMatchObject({ redacted: false, text: 'Readable' })
    expect(stub).toEqual({
      id: 2,
      authorId: 5,
      authorName: 'Dr. Author',
      authorRole: 'DOCTOR',
      visibility: 'PRIVATE',
      createdAt: '2026-09-20T10:00:00.000Z',
      redacted: true,
    })
    expect('text' in stub).toBe(false)
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

    db.exec(`
    CREATE TABLE users (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      role TEXT NOT NULL
    )
  `)

    db.prepare('INSERT INTO users (id, name, role) VALUES (?, ?, ?)').run(5, 'Dr. Author', 'DOCTOR')

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

    db.exec(`
    CREATE TABLE users (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      role TEXT NOT NULL
    )
  `)

    db.prepare('INSERT INTO users (id, name, role) VALUES (?, ?, ?)').run(5, 'Dr. Author', 'DOCTOR')

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

    expect(doctorNotes[0]?.author_name).toBe('Dr. Author')
    expect(doctorNotes[0]?.author_role).toBe('DOCTOR')

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
