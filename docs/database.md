# Database Schema and ER Sketch

Aletheia uses SQLite for users, patients, medical notes and sessions.

## Entity-Relationship Diagram

```mermaid
erDiagram
    PATIENTS ||--o| USERS : "patient account"
    PATIENTS ||--o{ NOTES : "has"
    USERS ||--o{ NOTES : "writes"

    PATIENTS {
        INTEGER id PK
        TEXT name
        TEXT personal_number UK
        TEXT created_at
    }

    USERS {
        INTEGER id PK
        TEXT username UK
        TEXT password_hash
        TEXT name
        TEXT role
        INTEGER patient_id FK UK
        TEXT created_at
    }

    NOTES {
        INTEGER id PK
        INTEGER patient_id FK
        INTEGER author_id FK
        TEXT text
        TEXT visibility
        TEXT created_at
    }

    SESSIONS {
        TEXT sid PK
        TEXT sess
        INTEGER expired
    }
```

## Roles

The `users.role` field uses the following values:

- `DOCTOR`
- `NURSE`
- `CLINIC`
- `PATIENT`
- `UNAUTHORIZED`

## Note visibility

The `notes.visibility` field uses the following values:

- `PRIVATE`
- `STAFF`
- `ALL`

## Database rules

- Patient data and medical notes are stored in SQLite.
- Patient users are linked to their patient record through `users.patient_id`.
- Each patient account can be linked to at most one patient record.
- Notes reference both the patient and the user who created them.
- Passwords are stored as password hashes.
- Foreign key constraints are enabled in SQLite.