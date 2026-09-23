import type { Request } from 'express'
import { afterEach, describe, expect, it } from 'vitest'
import { logAccessEvent } from './audit-logger.js'
import { Blockchain } from './chain/blockchain.js'

const originalPort = process.env.PORT
const originalServerId = process.env.SERVER_ID

afterEach(() => {
  process.env.PORT = originalPort
  process.env.SERVER_ID = originalServerId
})

function requestFor(userId: number): Request {
  return {
    session: {
      user: { id: userId, username: 'doctor', name: 'Doc', role: 'DOCTOR', patientId: null },
    },
  } as unknown as Request
}

describe('logAccessEvent', () => {
  it('stamps the event with the node it happened on', () => {
    process.env.SERVER_ID = ''
    process.env.PORT = '3002'
    const blockchain = new Blockchain()

    logAccessEvent(requestFor(1), blockchain, 7, 'READ')

    expect(blockchain.getLatestBlock().data[0]).toMatchObject({
      patientId: 7,
      action: 'READ',
      serverId: 'server-3002',
    })
  })

  it('does not stamp every node with the same name', () => {
    const first = new Blockchain()
    process.env.SERVER_ID = ''
    process.env.PORT = '3001'
    logAccessEvent(requestFor(1), first, 7, 'READ')

    const second = new Blockchain()
    process.env.PORT = '3002'
    logAccessEvent(requestFor(1), second, 7, 'READ')

    expect(first.getLatestBlock().data[0]?.serverId).not.toBe(
      second.getLatestBlock().data[0]?.serverId,
    )
  })

  it('records nothing for a request with no session', () => {
    const blockchain = new Blockchain()
    const lengthBefore = blockchain.chain.length

    logAccessEvent({ session: {} } as unknown as Request, blockchain, 7, 'READ')

    expect(blockchain.chain.length).toBe(lengthBefore)
  })
})
