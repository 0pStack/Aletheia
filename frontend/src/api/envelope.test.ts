import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { parseEnvelope } from './envelope'

const userSchema = z.object({ id: z.string(), name: z.string() })

describe('parseEnvelope', () => {
  it('returns typed data from a success envelope', () => {
    const raw = { success: true, data: { id: 'u1', name: 'Dr. Berg' }, error: null }

    expect(parseEnvelope(raw, userSchema)).toEqual({
      ok: true,
      data: { id: 'u1', name: 'Dr. Berg' },
    })
  })

  it('returns the server message from an error envelope', () => {
    const raw = { success: false, data: null, error: 'Invalid credentials' }

    expect(parseEnvelope(raw, userSchema)).toEqual({ ok: false, error: 'Invalid credentials' })
  })

  it('rejects a body that is not an envelope', () => {
    const result = parseEnvelope('<html>502 Bad Gateway</html>', userSchema)

    expect(result.ok).toBe(false)
  })

  it('rejects a success envelope whose data does not match the schema', () => {
    const raw = { success: true, data: { id: 42 }, error: null }

    expect(parseEnvelope(raw, userSchema).ok).toBe(false)
  })
})
