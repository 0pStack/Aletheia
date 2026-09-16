import { z } from 'zod'

const envelopeErrorSchema = z.object({ code: z.string(), message: z.string() })

const envelopeSchema = z.discriminatedUnion('success', [
  z.object({ success: z.literal(true), data: z.unknown(), error: z.null() }),
  z.object({ success: z.literal(false), data: z.null(), error: envelopeErrorSchema }),
])

export type EnvelopeError = { code: string; message: string }
export type EnvelopeResult<T> = { ok: true; data: T } | { ok: false; error: EnvelopeError }

const INVALID_RESPONSE_ERROR: EnvelopeError = {
  code: 'INVALID_RESPONSE',
  message: 'Unexpected response from server',
}

const INVALID_DATA_ERROR: EnvelopeError = {
  code: 'INVALID_RESPONSE',
  message: 'Response data did not match the expected shape',
}

export function parseEnvelope<T>(raw: unknown, dataSchema: z.ZodType<T>): EnvelopeResult<T> {
  const envelope = envelopeSchema.safeParse(raw)
  if (!envelope.success) return { ok: false, error: INVALID_RESPONSE_ERROR }

  if (!envelope.data.success) return { ok: false, error: envelope.data.error }

  const data = dataSchema.safeParse(envelope.data.data)
  if (!data.success) return { ok: false, error: INVALID_DATA_ERROR }

  return { ok: true, data: data.data }
}
