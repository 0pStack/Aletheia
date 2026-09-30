import { describe, expect, it } from 'vitest'
import { resolveTrustProxy } from './trust-proxy.js'

describe('resolveTrustProxy', () => {
  it.each([undefined, '', '   ', '0'])('trusts no proxy for %j', (raw) => {
    expect(resolveTrustProxy(raw)).toBe(0)
  })

  it('trusts the given number of proxy hops', () => {
    expect(resolveTrustProxy('1')).toBe(1)
    expect(resolveTrustProxy(' 2 ')).toBe(2)
  })

  it.each(['true', 'yes', '-1', '1.5', 'loopback'])('refuses TRUST_PROXY=%j', (raw) => {
    expect(() => resolveTrustProxy(raw)).toThrow(/TRUST_PROXY/)
  })
})
