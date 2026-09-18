import Database, { type Database as DatabaseType } from 'better-sqlite3'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DB_PATH = join(__dirname, '../db/aletheia.db')

export const db: DatabaseType = new Database(DB_PATH)
db.pragma('foreign_keys = ON')
