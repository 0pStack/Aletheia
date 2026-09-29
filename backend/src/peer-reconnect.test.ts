import { describe, expect, it } from 'vitest'
import {
  PEER_RECONNECT_BASE_DELAY_MS,
  PEER_RECONNECT_MAX_DELAY_MS,
  peerReconnectDelay,
} from './peer-reconnect.js'

describe('peerReconnectDelay', () => {
  it('doubles the delay with every failed attempt', () => {
    const delays = [0, 1, 2, 3].map((attempt) => peerReconnectDelay(attempt, () => 1))

    expect(delays).toEqual([1000, 2000, 4000, 8000])
  })

  it('never waits longer than the cap', () => {
    expect(peerReconnectDelay(50, () => 1)).toBe(PEER_RECONNECT_MAX_DELAY_MS)
    expect(peerReconnectDelay(Number.MAX_SAFE_INTEGER, () => 1)).toBe(PEER_RECONNECT_MAX_DELAY_MS)
  })

  it('adds jitter so nodes do not retry in lockstep, keeping at least half the delay', () => {
    expect(peerReconnectDelay(2, () => 0)).toBe(2000)
    expect(peerReconnectDelay(2, () => 0.5)).toBe(3000)
    expect(peerReconnectDelay(50, () => 0)).toBe(PEER_RECONNECT_MAX_DELAY_MS / 2)
  })

  it('starts at the base delay', () => {
    expect(peerReconnectDelay(0, () => 1)).toBe(PEER_RECONNECT_BASE_DELAY_MS)
  })
})
