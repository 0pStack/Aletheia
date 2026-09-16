import Database from 'better-sqlite3'
import { describe, expect, it } from 'vitest'

describe('better-sqlite3 native binding', () => {
  it('opens an in-memory database and runs a query', () => {
    const db = new Database(':memory:')

    const row = db.prepare('SELECT 1 + 1 AS result').get()
    db.close()

    expect(row).toEqual({ result: 2 })
  })
})
