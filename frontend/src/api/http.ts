import type { z } from 'zod'
import { parseEnvelope } from './envelope'

export class ApiError extends Error {
  readonly status: number
  readonly code: string

  constructor(status: number, code: string, message: string, options?: ErrorOptions) {
    super(message, options)
    this.name = 'ApiError'
    this.status = status
    this.code = code
  }
}

const NETWORK_ERROR_STATUS = 0
const NETWORK_ERROR_CODE = 'NETWORK_ERROR'

type JsonBody = { ok: true; body: unknown } | { ok: false; cause: unknown }

async function readJson(response: Response): Promise<JsonBody> {
  try {
    return { ok: true, body: await response.json() }
  } catch (cause) {
    return { ok: false, cause }
  }
}

export async function request<T>(
  path: string,
  dataSchema: z.ZodType<T>,
  init: RequestInit = {},
): Promise<T> {
  // Node's fetch (used by Vitest) rejects relative URLs, so resolve against the page origin.
  const url = new URL(path, window.location.origin)
  const headers = new Headers(init.headers)
  if (!headers.has('Accept')) headers.set('Accept', 'application/json')

  let response: Response
  try {
    response = await fetch(url, { ...init, headers, credentials: 'include' })
  } catch (cause) {
    throw new ApiError(NETWORK_ERROR_STATUS, NETWORK_ERROR_CODE, 'Could not reach the server', {
      cause,
    })
  }

  const json = await readJson(response)
  const result = parseEnvelope(json.ok ? json.body : null, dataSchema)

  if (!result.ok) {
    throw new ApiError(
      response.status,
      result.error.code,
      result.error.message,
      json.ok ? undefined : { cause: json.cause },
    )
  }
  return result.data
}
