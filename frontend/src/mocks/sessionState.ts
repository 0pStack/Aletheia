import { mockUsers, type MockUser } from './data'

// The mock API stands in for a server-side cookie session, so it needs somewhere to
// remember who is "logged in" between requests. Module-level state is the simplest way
// to do that for MSW handlers; resetMockSession() keeps it from leaking between tests.
let currentUserId: string | null = null

export function getCurrentSessionUser(): MockUser | null {
  return mockUsers.find((user) => user.id === currentUserId) ?? null
}

export function setCurrentSessionUserId(id: string | null): void {
  currentUserId = id
}

export function resetMockSession(): void {
  currentUserId = null
}
