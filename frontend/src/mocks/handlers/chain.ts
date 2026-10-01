import { http, HttpResponse } from 'msw'
import type { ChainStatus } from '../../api/schemas'

// The mock has no chain to tamper with, so it always reports an untouched one.
const HONEST_CHAIN: ChainStatus = {
  valid: true,
  firstInvalidBlockIndex: null,
  tamperDetected: null,
}

export const chainHandlers = [
  http.get('*/api/chain/status', () =>
    HttpResponse.json({ success: true, data: HONEST_CHAIN, error: null }),
  ),
]
