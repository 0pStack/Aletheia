import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { parseEnvelope } from './envelope'

const userSchema = z.object({ id: z.number(), name: z.string() })

describe('parseEnvelope', () => {
  it('returns typed data from a success envelope', () => {
    const raw = { success: true, data: { id: 1, name: 'Dr. Berg' }, error: null }

    expect(parseEnvelope(raw, userSchema)).toEqual({
      ok: true,
      data: { id: 1, name: 'Dr. Berg' },
    })
  })

  it('returns the server error code and message from an error envelope', () => {
    const raw = {
      success: false,
      data: null,
      error: { code: 'INVALID_CREDENTIALS', message: 'Invalid credentials' },
    }

    expect(parseEnvelope(raw, userSchema)).toEqual({
      ok: false,
      error: { code: 'INVALID_CREDENTIALS', message: 'Invalid credentials' },
    })
  })

  it('rejects a body that is not an envelope', () => {
    const result = parseEnvelope('<html>502 Bad Gateway</html>', userSchema)

    expect(result).toEqual({
      ok: false,
      error: { code: 'INVALID_RESPONSE', message: 'Unexpected response from server' },
    })
  })

  it('rejects an error envelope whose error is a plain string instead of an object', () => {
    const raw = { success: false, data: null, error: 'Invalid credentials' }

    expect(parseEnvelope(raw, userSchema).ok).toBe(false)
  })

  it('rejects a success envelope whose data does not match the schema', () => {
    const raw = { success: true, data: { id: 42 }, error: null }

    expect(parseEnvelope(raw, userSchema)).toEqual({
      ok: false,
      error: {
        code: 'INVALID_RESPONSE',
        message: 'Response data did not match the expected shape',
      },
    })
  })
})
