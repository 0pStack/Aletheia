import { describe, expect, it } from 'vitest'
import request from 'supertest'
import { createApp } from './app.js'
import { Blockchain } from './chain/blockchain.js'
import { generateKeyPair } from './chain/keypair.js'

describe('GET /api/health', () => {
  it('responds with the success envelope and status ok', async () => {
    const app = createApp({ keyPair: generateKeyPair() })

    const response = await request(app).get('/api/health')

    expect(response.status).toBe(200)
    expect(response.body).toEqual({
      success: true,
      data: { status: 'ok' },
      error: null,
    })
  })
})

describe('GET /api/chain/status', () => {
  it('reports a valid chain with no invalid block index', async () => {
    const app = createApp({ keyPair: generateKeyPair(), blockchain: new Blockchain() })

    const response = await request(app).get('/api/chain/status')

    expect(response.status).toBe(200)
    expect(response.body).toEqual({
      success: true,
      data: { valid: true, firstInvalidBlockIndex: null, tamperDetected: null },
      error: null,
    })
  })

  it('reports the first invalid block in a tampered chain', async () => {
    const blockchain = new Blockchain()
    const tamperedBlock = blockchain.addBlock([])
    tamperedBlock.hash = 'tampered'
    const app = createApp({ keyPair: generateKeyPair(), blockchain })

    const response = await request(app).get('/api/chain/status')

    expect(response.status).toBe(200)
    expect(response.body).toEqual({
      success: true,
      data: {
        valid: false,
        firstInvalidBlockIndex: 1,
        tamperDetected: { blockIndex: 1, detectedAt: expect.any(String) },
      },
      error: null,
    })
  })

  it('still reports the tampering after the chain is valid again', async () => {
    const blockchain = new Blockchain()
    const block = blockchain.addBlock([])
    const realHash = block.hash
    block.hash = 'tampered'
    blockchain.findFirstInvalidBlockIndex()
    block.hash = realHash
    const app = createApp({ keyPair: generateKeyPair(), blockchain })

    const response = await request(app).get('/api/chain/status')

    expect(response.body.data).toMatchObject({
      valid: true,
      firstInvalidBlockIndex: null,
      tamperDetected: { blockIndex: 1 },
    })
  })
})
