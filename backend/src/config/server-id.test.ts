import { describe, expect, it } from 'vitest'
import { DEFAULT_PORT } from './port.js'
import { resolveServerId } from './server-id.js'

describe('resolveServerId', () => {
  it('names the node after the port it listens on', () => {
    expect(resolveServerId({ PORT: '3002' })).toBe('server-3002')
    expect(resolveServerId({ PORT: '3001' })).toBe('server-3001')
  })

  it('falls back to the default port when none is set', () => {
    expect(resolveServerId({})).toBe(`server-${DEFAULT_PORT}`)
  })

  it('prefers an explicit SERVER_ID', () => {
    expect(resolveServerId({ SERVER_ID: 'ambulance-north', PORT: '3002' })).toBe('ambulance-north')
  })

  it('ignores a blank SERVER_ID rather than stamping events with nothing', () => {
    expect(resolveServerId({ SERVER_ID: '   ', PORT: '3002' })).toBe('server-3002')
  })

  it('gives two nodes on different ports different names', () => {
    expect(resolveServerId({ PORT: '3001' })).not.toBe(resolveServerId({ PORT: '3002' }))
  })
})
