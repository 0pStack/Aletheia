import { describe, expect, it } from 'vitest'
import { initialsOf } from './initials'

describe('initialsOf', () => {
  it('takes the first letter of the first and last name', () => {
    expect(initialsOf('anna maria lindqvist')).toBe('AL')
  })

  it('uses one letter for a single name', () => {
    expect(initialsOf('  Cher ')).toBe('C')
  })

  it('is empty for a blank name', () => {
    expect(initialsOf('   ')).toBe('')
  })
})
