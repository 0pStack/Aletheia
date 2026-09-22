export const DEFAULT_PORT = 3001

const MAX_PORT = 65535

export function resolvePort(rawPort: string | undefined): number {
  const trimmed = rawPort?.trim()
  if (!trimmed) return DEFAULT_PORT

  const parsed = Number(trimmed)
  const isValid = Number.isInteger(parsed) && parsed > 0 && parsed <= MAX_PORT
  return isValid ? parsed : DEFAULT_PORT
}
