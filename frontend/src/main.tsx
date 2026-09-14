import '@fontsource/inter/300.css'
import '@fontsource/inter/400.css'
import '@fontsource/inter/600.css'
import './styles/reset.css'
import './styles/tokens.css'
import './styles/global.css'

import { QueryClientProvider } from '@tanstack/react-query'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter } from 'react-router'
import { RouterProvider } from 'react-router/dom'
import { createQueryClient } from './app/queryClient'
import { routes } from './app/router'

// On by default in development so a fresh clone works without a .env or a running backend;
// production builds never include mocks.
const useMocks = import.meta.env.DEV && import.meta.env.VITE_USE_MOCKS !== 'false'

async function enableMocks() {
  if (!useMocks) return
  // Dynamic import keeps MSW out of the production bundle.
  const { worker } = await import('./mocks/browser')
  await worker.start({ onUnhandledRequest: 'bypass' })
}

const rootElement = document.getElementById('root')
if (!rootElement) throw new Error('Missing #root element in index.html')

try {
  await enableMocks()
} catch (error) {
  // Render anyway: the session check then surfaces a visible error instead of a blank page.
  console.error('MSW failed to start; requests will go to the real backend.', error)
}

createRoot(rootElement).render(
  <StrictMode>
    <QueryClientProvider client={createQueryClient()}>
      <RouterProvider router={createBrowserRouter(routes)} />
    </QueryClientProvider>
  </StrictMode>,
)
