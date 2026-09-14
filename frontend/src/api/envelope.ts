import { z } from 'zod'

// Placeholder shape until issue #3 lands in docs/interfaces.md. This is the only
// file that knows the envelope format, so agreeing on #3 means editing just this.
const envelopeSchema = z.discriminatedUnion('success', [
  z.object({ success: z.literal(true), data: z.unknown(), error: z.null() }),
  z.object({ success: z.literal(false), data: z.null(), error: z.string() }),
])

export type EnvelopeResult<T> = { ok: true; data: T } | { ok: false; error: string }

export function parseEnvelope<T>(raw: unknown, dataSchema: z.ZodType<T>): EnvelopeResult<T> {
  const envelope = envelopeSchema.safeParse(raw)
  if (!envelope.success) return { ok: false, error: 'Unexpected response from server' }

  if (!envelope.data.success) return { ok: false, error: envelope.data.error }

  const data = dataSchema.safeParse(envelope.data.data)
  if (!data.success) return { ok: false, error: 'Response data did not match the expected shape' }

  return { ok: true, data: data.data }
}
