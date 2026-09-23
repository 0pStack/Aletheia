import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterAll, afterEach, beforeAll } from 'vitest'
import { resetNoteStore } from '../mocks/noteStore'
import { server } from '../mocks/server'
import { resetMockSession } from '../mocks/sessionState'

// jsdom does no layout, so it leaves scrollIntoView out; the landing page calls it for /#patients.
Element.prototype.scrollIntoView = () => {}

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => {
  server.resetHandlers()
  resetMockSession()
  resetNoteStore()
  cleanup()
})
afterAll(() => server.close())
