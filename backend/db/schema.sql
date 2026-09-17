PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS patients (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    personal_number TEXT NOT NULL UNIQUE,
    created_at TEXT NOT NULL DEFAULT (datetime('now', 'utc'))
);

CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    name TEXT NOT NULL,
    role TEXT NOT NULL CHECK (
        role IN ('DOCTOR', 'NURSE', 'CLINIC', 'PATIENT', 'UNAUTHORIZED')
    ),
    patient_id INTEGER UNIQUE,
    created_at TEXT NOT NULL DEFAULT (datetime('now', 'utc')),
    FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS notes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    patient_id INTEGER NOT NULL,
    author_id INTEGER NOT NULL,
    text TEXT NOT NULL,
    visibility TEXT NOT NULL CHECK (
        visibility IN ('PRIVATE', 'STAFF', 'ALL')
    ),
    created_at TEXT NOT NULL DEFAULT (datetime('now', 'utc')),
    FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE,
    FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS sessions (
    sid TEXT PRIMARY KEY NOT NULL,
    sess TEXT NOT NULL,
    expired INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_patients_personal_number
    ON patients(personal_number);

CREATE INDEX IF NOT EXISTS idx_patients_name
    ON patients(name);

CREATE INDEX IF NOT EXISTS idx_notes_patient_id
    ON notes(patient_id);

CREATE INDEX IF NOT EXISTS idx_notes_visibility
    ON notes(visibility);

CREATE INDEX IF NOT EXISTS idx_sessions_expired
    ON sessions(expired);