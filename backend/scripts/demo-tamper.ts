import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { CHAIN_DIR, TAMPER_OK, TAMPER_REQUEST, TAMPER_RESULT } from './demo-paths.js'

const PICKUP_TIMEOUT_MS = 10_000
const RESULT_TIMEOUT_MS = 60_000
const POLL_INTERVAL_MS = 250

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

async function waitFor(check: () => boolean, timeoutMs: number): Promise<boolean> {
  const deadline = Date.now() + timeoutMs
  while (!check()) {
    if (Date.now() > deadline) return false
    await wait(POLL_INTERVAL_MS)
  }
  return true
}

function writeRequest(): void {
  try {
    writeFileSync(TAMPER_REQUEST, new Date().toISOString(), { flag: 'wx' })
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'EEXIST') {
      throw new Error('A tamper request is already waiting for the demo.', { cause: error })
    }
    throw error
  }
}

// The nodes belong to the `npm run demo` process, so this script only asks it to tamper.
async function run(): Promise<void> {
  if (!existsSync(CHAIN_DIR)) {
    throw new Error('No demo chains found. Start `npm run demo` first.')
  }

  rmSync(TAMPER_RESULT, { force: true })
  writeRequest()
  console.info('Asked the running demo to tamper with node 3002, waiting for it...')

  if (!(await waitFor(() => !existsSync(TAMPER_REQUEST), PICKUP_TIMEOUT_MS))) {
    rmSync(TAMPER_REQUEST, { force: true })
    throw new Error(
      'The demo did not pick up the request. Is `npm run demo` running, past its setup, and not tampered already?',
    )
  }

  if (!(await waitFor(() => existsSync(TAMPER_RESULT), RESULT_TIMEOUT_MS))) {
    throw new Error('The demo picked up the request but never reported back. Check its terminal.')
  }

  const result = readFileSync(TAMPER_RESULT, 'utf8')
  rmSync(TAMPER_RESULT, { force: true })
  if (result !== TAMPER_OK) throw new Error(`The demo failed to tamper: ${result}`)

  console.info('Done. See the demo terminal for the chain status of both nodes.')
}

run().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
