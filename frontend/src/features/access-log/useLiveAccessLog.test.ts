import { describe, expect, it } from 'vitest'
import { blockTouchesPatient } from './useLiveAccessLog'

const newBlock = (patientIds: number[]) =>
  JSON.stringify({
    type: 'NEW_BLOCK',
    block: { data: patientIds.map((patientId) => ({ patientId })) },
  })

describe('blockTouchesPatient', () => {
  it('is true when the block holds an event for the patient', () => {
    expect(blockTouchesPatient(newBlock([2, 4]), 4)).toBe(true)
  })

  it('is false when the block is about other patients', () => {
    expect(blockTouchesPatient(newBlock([2, 3]), 4)).toBe(false)
  })

  it('ignores other message types and junk', () => {
    expect(blockTouchesPatient(JSON.stringify({ type: 'CHAIN_REQUEST' }), 4)).toBe(false)
    expect(blockTouchesPatient('not json', 4)).toBe(false)
    expect(blockTouchesPatient(JSON.stringify({ type: 'NEW_BLOCK', block: null }), 4)).toBe(false)
  })
})
