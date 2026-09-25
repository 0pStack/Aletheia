import { describe, expect, it } from 'vitest'
import { resolveSessionSecret } from './session-secret.js'

describe('resolveSessionSecret', () => {
  it('uses the configured secret when there is one', () => {
    expect(resolveSessionSecret('a-long-configured-secret')).toBe('a-long-configured-secret')
  })

  it.each([undefined, '', '   '])('generates a random secret for %j', (rawSecret) => {
    const secret = resolveSessionSecret(rawSecret)

    expect(secret).toMatch(/^[0-9a-f]{64}$/)
  })

  it('never falls back to the same secret twice, so it cannot be known in advance', () => {
    expect(resolveSessionSecret(undefined)).not.toBe(resolveSessionSecret(undefined))
  })
})
