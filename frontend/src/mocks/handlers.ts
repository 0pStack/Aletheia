import { accessLogHandlers } from './handlers/accessLog'
import { authHandlers } from './handlers/auth'
import { patientHandlers } from './handlers/patients'
import { verifyHandlers } from './handlers/verify'

// Endpoint paths and shapes are not agreed with the backend track yet (issue #3);
// see docs/current-work.md, sections #3 and #6, for what is assumed here.
export const handlers = [
  ...authHandlers,
  ...patientHandlers,
  ...accessLogHandlers,
  ...verifyHandlers,
]
