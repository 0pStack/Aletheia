import { describe, expect, it } from 'vitest'
import { DEFAULT_PORT, resolvePort } from './port.js'

describe('resolvePort', () => {
  it('uses the given port when it is a valid integer', () => {
    expect(resolvePort('4000')).toBe(4000)
    expect(resolvePort('65535')).toBe(65535)
  })

  it.each([undefined, '', '   ', 'abc', '0', '-1', '3000.5', '65536', '99999'])(
    'falls back to the default port for %j',
    (rawPort) => {
      expect(resolvePort(rawPort)).toBe(DEFAULT_PORT)
    },
  )
})
