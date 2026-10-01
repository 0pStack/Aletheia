import { spawn, spawnSync, type ChildProcess } from 'node:child_process'
import { existsSync, rmSync, writeFileSync } from 'node:fs'
import { loadChain, saveChain } from '../src/chain/chain-storage.js'
import { resolveChainPath } from '../src/config/chain-path.js'
import { tamperChain } from '../src/demo/tamper.js'
import { CHAIN_DIR, TAMPER_OK, TAMPER_REQUEST, TAMPER_RESULT } from './demo-paths.js'

const PASSWORD = 'Password123!'
const NODE_1 = 3001
const NODE_2 = 3002
const STARTUP_TIMEOUT_MS = 30_000
const SYNC_TIMEOUT_MS = 20_000
const POLL_INTERVAL_MS = 250

interface Envelope<T> {
  success: boolean
  data: T
  error: { code: string; message: string } | null
}

interface User {
  id: number
  username: string
  name: string
  role: string
  patientId: number | null
}

interface PatientSummary {
  id: number
  name: string
}

interface ChainStatus {
  valid: boolean
  firstInvalidBlockIndex: number | null
}

interface Session {
  port: number
  cookie: string
  user: User
}

const nodes = new Map<number, ChildProcess>()

function step(title: string): void {
  console.info(`\n\x1b[1m== ${title}\x1b[0m`)
}

function say(message: string): void {
  console.info(`   ${message}`)
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

function seedDatabase(): void {
  const result = spawnSync(process.execPath, ['--import', 'tsx', 'db/seed.ts'], {
    stdio: 'inherit',
  })
  if (result.status !== 0) throw new Error('Seeding the database failed')
}

function prefixOutput(stream: NodeJS.ReadableStream | null, label: string): void {
  let buffer = ''
  stream?.setEncoding('utf8')
  stream?.on('data', (chunk: string) => {
    const lines = (buffer + chunk).split('\n')
    buffer = lines.pop() ?? ''
    for (const line of lines) console.info(`\x1b[2m[${label}] ${line.trimEnd()}\x1b[0m`)
  })
}

// Started through node directly rather than `npm run dev:node1`, whose inline
// `PORT=3001` syntax does not work in the Windows shell npm uses.
function startNode(port: number, peerPort: number): void {
  const child = spawn(process.execPath, ['--import', 'tsx', 'src/index.ts'], {
    env: {
      ...process.env,
      PORT: String(port),
      PEERS: `ws://localhost:${peerPort}`,
      CHAIN_DIR,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  prefixOutput(child.stdout, `node ${port}`)
  prefixOutput(child.stderr, `node ${port}`)
  child.on('error', (error) => {
    console.error(`Node ${port} could not be started: ${error.message}`)
  })
  child.on('exit', (code) => {
    if (nodes.get(port) === child) {
      nodes.delete(port)
      console.error(`Node ${port} exited unexpectedly with code ${code}`)
    }
  })
  nodes.set(port, child)
}

// On Windows kill() ends the node without running its flush-on-SIGTERM handler. That is
// safe here only because the demo stops a node after waitForSync, when every event is
// already on disk.
async function stopNode(port: number): Promise<void> {
  const child = nodes.get(port)
  if (!child) return
  nodes.delete(port)
  const exited = new Promise((resolve) => child.once('exit', resolve))
  child.kill()
  await exited
}

async function waitUntil(check: () => Promise<boolean>, timeoutMs: number, what: string) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (await check().catch(() => false)) return
    await wait(POLL_INTERVAL_MS)
  }
  throw new Error(`Timed out after ${timeoutMs} ms waiting for ${what}`)
}

async function waitForHealth(port: number): Promise<void> {
  await waitUntil(
    async () => (await fetch(`http://localhost:${port}/api/health`)).ok,
    STARTUP_TIMEOUT_MS,
    `node ${port} to start`,
  )
}

async function request<T>(
  port: number,
  path: string,
  init: RequestInit & { cookie?: string } = {},
): Promise<{ status: number; body: Envelope<T>; headers: Headers }> {
  const response = await fetch(`http://localhost:${port}${path}`, {
    ...init,
    headers: {
      'content-type': 'application/json',
      ...(init.cookie ? { cookie: init.cookie } : {}),
    },
  })
  const body = (await response.json()) as Envelope<T>
  return { status: response.status, body, headers: response.headers }
}

async function login(port: number, username: string): Promise<Session> {
  const { status, body, headers } = await request<{ user: User }>(port, '/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password: PASSWORD }),
  })
  const cookie = headers.getSetCookie()[0]?.split(';')[0]
  if (status !== 200 || !cookie) {
    throw new Error(`Login as ${username} on node ${port} failed: ${body.error?.message}`)
  }
  say(`${body.data.user.name} (${body.data.user.role}) signed in on node ${port}`)
  return { port, cookie, user: body.data.user }
}

async function readJournal(session: Session, patient: PatientSummary): Promise<void> {
  const { status } = await request(session.port, `/api/patients/${patient.id}`, {
    cookie: session.cookie,
  })
  const outcome = status === 200 ? 'READ' : `refused with ${status}, logged as DENIED`
  say(`${session.user.name} opens ${patient.name}'s journal on node ${session.port}: ${outcome}`)
}

async function listPatients(session: Session): Promise<PatientSummary[]> {
  const { body } = await request<PatientSummary[]>(session.port, '/api/patients', {
    cookie: session.cookie,
  })
  return body.data
}

async function writeNote(session: Session, patient: PatientSummary): Promise<void> {
  const { status } = await request(session.port, `/api/patients/${patient.id}/notes`, {
    method: 'POST',
    cookie: session.cookie,
    body: JSON.stringify({ text: 'Follow-up booked for next week.', visibility: 'STAFF' }),
  })
  say(
    `${session.user.name} writes a note in ${patient.name}'s journal: ${status < 300 ? 'WRITE' : `failed with ${status}`}`,
  )
}

function chainOf(port: number) {
  return loadChain(resolveChainPath({ CHAIN_DIR }, port)) ?? []
}

async function waitForSync(): Promise<number> {
  await waitUntil(
    async () => {
      const [a, b] = [chainOf(NODE_1), chainOf(NODE_2)]
      return a.length > 2 && a.at(-1)?.hash === b.at(-1)?.hash
    },
    SYNC_TIMEOUT_MS,
    'both nodes to hold the same chain',
  )
  return chainOf(NODE_1).length
}

async function chainStatus(port: number): Promise<ChainStatus> {
  const { body } = await request<ChainStatus>(port, '/api/chain/status')
  return body.data
}

function describeStatus(port: number, status: ChainStatus): string {
  return status.valid
    ? `node ${port}: chain valid`
    : `node ${port}: chain INVALID from block ${status.firstInvalidBlockIndex}`
}

function findPatient(patients: PatientSummary[], name: string): PatientSummary {
  const patient = patients.find((p) => p.name === name)
  if (!patient) throw new Error(`Seed data has no patient called ${name}`)
  return patient
}

async function generateActivity(): Promise<{ nurse: User }> {
  const doctor = await login(NODE_1, 'doctor_dr_house')
  const nurse = await login(NODE_2, 'nurse_jackie')
  const anna = await login(NODE_1, 'patient_anna')

  const patients = await listPatients(doctor)
  const annaRecord = findPatient(patients, 'Anna Andersson')
  const bengt = findPatient(patients, 'Bengt Berg')

  for (const patient of patients) await readJournal(doctor, patient)
  await writeNote(doctor, annaRecord)
  await readJournal(nurse, annaRecord)
  await readJournal(anna, bengt)

  return { nurse: nurse.user }
}

async function tamperWithNode2(scapegoat: User): Promise<void> {
  await stopNode(NODE_2)
  say(`Node ${NODE_2} stopped`)

  const chainPath = resolveChainPath({ CHAIN_DIR }, NODE_2)
  const { chain, tamperedIndex } = tamperChain(chainOf(NODE_2), scapegoat.id)
  saveChain(chainPath, chain)
  say(
    `Rewrote block ${tamperedIndex} in ${chainPath} so the first recorded access names ${scapegoat.name} instead`,
  )

  startNode(NODE_2, NODE_1)
  await waitForHealth(NODE_2)
  say(`Node ${NODE_2} restarted from the edited file`)
}

async function run(): Promise<void> {
  step('1. Seed the database')
  seedDatabase()
  rmSync(CHAIN_DIR, { recursive: true, force: true })

  step('2. Start both nodes')
  startNode(NODE_1, NODE_2)
  startNode(NODE_2, NODE_1)
  await Promise.all([waitForHealth(NODE_1), waitForHealth(NODE_2)])
  say(`Nodes up on ${NODE_1} and ${NODE_2}, chains in ${CHAIN_DIR}/`)

  step('3. Use the journal')
  const { nurse } = await generateActivity()

  step('4. Wait for the nodes to agree')
  const length = await waitForSync()
  say(`Both nodes hold the same ${length}-block chain`)
  for (const port of [NODE_1, NODE_2]) say(describeStatus(port, await chainStatus(port)))

  step('Demo running, both chains valid')
  say('Frontend: cd ../frontend && npm run dev, then open http://localhost:5173')
  say(`Chain status: http://localhost:${NODE_1}/api/chain/status and :${NODE_2}`)
  say('When the P2P part is done, run `npm run demo:tamper` in another terminal')
  say('Press Ctrl+C to stop both nodes')

  // Tampering waits for the request because node 3002 then rejects blocks until it resyncs
  // from 3001, which would interrupt the live P2P part of the presentation.
  await waitForTamperRequest()
  rmSync(TAMPER_REQUEST, { force: true })

  try {
    step('5. Tamper with the chain on disk')
    await tamperWithNode2(nurse)

    step('6. Detect it')
    for (const port of [NODE_1, NODE_2]) say(describeStatus(port, await chainStatus(port)))
    writeFileSync(TAMPER_RESULT, TAMPER_OK)
  } catch (error) {
    writeFileSync(TAMPER_RESULT, error instanceof Error ? error.message : String(error))
    throw error
  }
  say('Press Ctrl+C to stop both nodes')
}

async function waitForTamperRequest(): Promise<void> {
  while (!existsSync(TAMPER_REQUEST)) {
    // A node that died would make the tamper fail late and confusingly, so stop here.
    if (!nodes.has(NODE_1) || !nodes.has(NODE_2)) {
      throw new Error('A node stopped while waiting for `npm run demo:tamper`')
    }
    await wait(POLL_INTERVAL_MS)
  }
}

function stopAll(): void {
  for (const [port, child] of nodes) {
    nodes.delete(port)
    child.kill()
  }
}

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => {
    stopAll()
    process.exit(0)
  })
}

run().catch((error: unknown) => {
  console.error('\nDemo failed:', error instanceof Error ? error.message : error)
  stopAll()
  process.exit(1)
})
