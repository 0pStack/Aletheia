import { describe, expect, it } from 'vitest'
import { stableStringify } from './stable-stringify.js'

describe('stableStringify', () => {
  it('serializes primitives the same way JSON.stringify does', () => {
    expect(stableStringify('text')).toBe('"text"')
    expect(stableStringify(42)).toBe('42')
    expect(stableStringify(true)).toBe('true')
    expect(stableStringify(null)).toBe('null')
  })

  it('turns a top-level undefined into null instead of returning undefined', () => {
    expect(stableStringify(undefined)).toBe('null')
  })

  it('sorts object keys so insertion order does not change the output', () => {
    const a = { userId: 7, action: 'READ', id: 'e1' }
    const b = { id: 'e1', action: 'READ', userId: 7 }

    expect(stableStringify(a)).toBe('{"action":"READ","id":"e1","userId":7}')
    expect(stableStringify(b)).toBe(stableStringify(a))
  })

  it('sorts keys in nested objects too', () => {
    const value = { outer: { b: 2, a: 1 }, first: { z: { y: 1, x: 2 } } }

    expect(stableStringify(value)).toBe('{"first":{"z":{"x":2,"y":1}},"outer":{"a":1,"b":2}}')
  })

  it('keeps array order and sorts objects inside arrays', () => {
    const value = [3, { b: 1, a: 2 }, 'x']

    expect(stableStringify(value)).toBe('[3,{"a":2,"b":1},"x"]')
  })

  it('drops keys whose value is undefined, like JSON.stringify', () => {
    const value = { id: 'e1', signature: undefined }

    expect(stableStringify(value)).toBe('{"id":"e1"}')
    expect(stableStringify(value)).toBe(JSON.stringify({ id: 'e1' }))
  })

  it('keeps keys whose value is null', () => {
    expect(stableStringify({ patientId: null })).toBe('{"patientId":null}')
  })

  it('escapes keys and string values', () => {
    expect(stableStringify({ 'a"b': 'line\nbreak' })).toBe('{"a\\"b":"line\\nbreak"}')
  })

  it('produces output that parses back to an equal value', () => {
    const event = {
      id: 'e1',
      patientId: 1,
      userId: 2,
      role: 'DOCTOR',
      action: 'READ',
      timestamp: '2026-09-25T10:00:00.000Z',
      serverId: 'node-1',
    }

    expect(JSON.parse(stableStringify(event))).toEqual(event)
  })

  it('serializes empty containers', () => {
    expect(stableStringify({})).toBe('{}')
    expect(stableStringify([])).toBe('[]')
  })
})
