import Database from 'better-sqlite3';
import { randomBytes, scryptSync } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const DB_PATH = join(__dirname, 'aletheia.db');
const SCHEMA_PATH = join(__dirname, 'schema.sql');

const db = new Database(DB_PATH);
db.pragma('foreign_keys = ON');

function hashPassword(password: string): string {
    const salt = randomBytes(16).toString('hex');
    const derivedKey = scryptSync(password, salt, 64).toString('hex');

    return `${salt}:${derivedKey}`;
}

function seed() {
    console.log('Applying schema...');

    const schemaSql = readFileSync(SCHEMA_PATH, 'utf-8');
    db.exec(schemaSql);

    const clearTables = db.transaction(() => {
        db.prepare('DELETE FROM notes').run();
        db.prepare('DELETE FROM users').run();
        db.prepare('DELETE FROM patients').run();
        db.prepare('DELETE FROM sessions').run();
    });

    clearTables();

    console.log('Seeding data...');

    const insertPatient = db.prepare(
        'INSERT INTO patients (name, personal_number) VALUES (?, ?)'
    );

    const insertUser = db.prepare(
        'INSERT INTO users (username, password_hash, name, role, patient_id) VALUES (?, ?, ?, ?, ?)'
    );

    const insertNote = db.prepare(
        'INSERT INTO notes (patient_id, author_id, text, visibility) VALUES (?, ?, ?, ?)'
    );

    const seedTransaction = db.transaction(() => {
        const pat1 = insertPatient.run('Anna Andersson', '19850101-1234');
        const pat2 = insertPatient.run('Bengt Berg', '19700512-5678');
        const pat3 = insertPatient.run('Cecilia Carlsson', '19921130-9012');

        const pat1Id = Number(pat1.lastInsertRowid);
        const pat2Id = Number(pat2.lastInsertRowid);
        const pat3Id = Number(pat3.lastInsertRowid);

        const docUser = insertUser.run(
            'doctor_dr_house',
            hashPassword('Password123!'),
            'Dr. Gregory House',
            'DOCTOR',
            null
        );

        const nurseUser = insertUser.run(
            'nurse_jackie',
            hashPassword('Password123!'),
            'Jackie Peyton',
            'NURSE',
            null
        );

        const clinicUser = insertUser.run(
            'clinic_admin',
            hashPassword('Password123!'),
            'City Central Clinic',
            'CLINIC',
            null
        );

        insertUser.run(
            'patient_anna',
            hashPassword('Password123!'),
            'Anna Andersson',
            'PATIENT',
            pat1Id
        );

        insertUser.run(
            'unauth_user',
            hashPassword('Password123!'),
            'Eve Stranded',
            'UNAUTHORIZED',
            null
        );

        const docId = Number(docUser.lastInsertRowid);
        const nurseId = Number(nurseUser.lastInsertRowid);
        const clinicId = Number(clinicUser.lastInsertRowid);

        insertNote.run(
            pat1Id,
            docId,
            'Patient presents mild fever and sore throat. Prescribed rest.',
            'ALL'
        );

        insertNote.run(
            pat1Id,
            nurseId,
            'Observed elevated heart rate during check-in. Monitor daily.',
            'STAFF'
        );

        insertNote.run(
            pat1Id,
            docId,
            'Confidential physician observations regarding preliminary differential diagnosis.',
            'PRIVATE'
        );

        insertNote.run(
            pat2Id,
            docId,
            'Routine annual health examination. All values nominal.',
            'ALL'
        );

        insertNote.run(
            pat2Id,
            nurseId,
            'Patient reported mild anxiety during blood sampling.',
            'STAFF'
        );

        insertNote.run(
            pat3Id,
            clinicId,
            'Clinic follow-up completed.',
            'ALL'
        );
    });

    seedTransaction();

    console.log('Database seeded successfully at', DB_PATH);
}

try {
    seed();
} finally {
    db.close();
}