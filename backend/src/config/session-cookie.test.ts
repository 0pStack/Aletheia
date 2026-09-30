import { describe, expect, it } from 'vitest'
import { resolveSecureCookie } from './session-cookie.js'

describe('resolveSecureCookie', () => {
  it('is secure in production by default', () => {
    expect(resolveSecureCookie({ NODE_ENV: 'production' })).toBe(true)
  })

  it.each([{}, { NODE_ENV: 'development' }, { NODE_ENV: 'test' }])(
    'is not secure outside production by default (%j)',
    (env) => {
      expect(resolveSecureCookie(env)).toBe(false)
    },
  )

  it('lets SESSION_COOKIE_SECURE override the default either way', () => {
    expect(resolveSecureCookie({ SESSION_COOKIE_SECURE: 'true' })).toBe(true)
    expect(resolveSecureCookie({ NODE_ENV: 'production', SESSION_COOKIE_SECURE: 'false' })).toBe(
      false,
    )
    expect(resolveSecureCookie({ SESSION_COOKIE_SECURE: ' TRUE ' })).toBe(true)
  })

  it.each(['yes', '1', 'on', 'secure'])(
    'refuses to guess what SESSION_COOKIE_SECURE=%j means',
    (value) => {
      expect(() => resolveSecureCookie({ SESSION_COOKIE_SECURE: value })).toThrow(
        /SESSION_COOKIE_SECURE/,
      )
    },
  )
})
