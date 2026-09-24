import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { AccessEvent } from './access-event.js'
import { Block } from './block.js'
import { Blockchain } from './blockchain.js'
import { loadChain, saveChain } from './chain-storage.js'
import { signAccessEvent } from './access-event-signing.js'
import { generateKeyPair } from './keypair.js'

const testEvent: AccessEvent = {
  id: 'event-1',
  patientId: 123,
  userId: 45,
  role: 'DOCTOR',
  action: 'READ',
  timestamp: '2026-09-23T10:00:00.000Z',
  serverId: 'server-1',
}

const testKeys = generateKeyPair()
const signed = (event: AccessEvent): AccessEvent =>
  signAccessEvent(event, testKeys.privateKey, testKeys.publicKey)

let dir: string
let filePath: string

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'aletheia-chain-'))
  filePath = join(dir, 'chain.json')
})

afterEach(() => {
  rmSync(dir, { recursive: true, force: true })
})

function buildChain(): Blockchain {
  const blockchain = new Blockchain()
  blockchain.addBlock([signed(testEvent)])
  blockchain.addBlock([
    signed({ ...testEvent, id: 'event-2', action: 'WRITE' }),
    signed({ ...testEvent, id: 'event-3' }),
  ])
  return blockchain
}

describe('chain storage', () => {
  it('returns undefined when no chain has been saved', () => {
    expect(loadChain(filePath)).toBeUndefined()
  })

  it('loads the same chain that was saved', () => {
    const original = buildChain()

    saveChain(filePath, original.chain)
    const loaded = loadChain(filePath)

    expect(loaded?.map((block) => block.hash)).toEqual(original.chain.map((block) => block.hash))
  })

  it('rebuilds real Block instances', () => {
    saveChain(filePath, buildChain().chain)

    const loaded = loadChain(filePath) ?? []

    expect(loaded.every((block) => block instanceof Block)).toBe(true)
    expect(new Blockchain({ chain: loaded }).isChainValid()).toBe(true)
  })

  it('detects a block edited in the file instead of silently fixing its hash', () => {
    saveChain(filePath, buildChain().chain)

    const saved = JSON.parse(readFileSync(filePath, 'utf8')) as {
      data: { action: string }[]
    }[]
    const event = saved[1]?.data[0]
    if (!event) throw new Error('expected an event in block 1')
    event.action = 'WRITE'
    writeFileSync(filePath, JSON.stringify(saved))

    const loaded = loadChain(filePath) ?? []

    expect(new Blockchain({ chain: loaded }).isChainValid()).toBe(false)
  })

  it('leaves no temporary file behind', () => {
    saveChain(filePath, buildChain().chain)

    expect(existsSync(`${filePath}.tmp`)).toBe(false)
  })
})
