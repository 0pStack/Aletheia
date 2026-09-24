import { resolvePort } from './port.js'

// Which node recorded an event. Two nodes running side by side must not claim the same
// name, or the access log cannot say where a read happened. The port is what already
// distinguishes them (3001 and 3002), so it is what names them, unless a deployment
// says otherwise with SERVER_ID.
export function resolveServerId(env: NodeJS.ProcessEnv): string {
  const explicit = env.SERVER_ID?.trim()
  if (explicit) return explicit

  return `server-${resolvePort(env.PORT)}`
}
