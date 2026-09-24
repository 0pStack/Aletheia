import { Navigate, type RouteObject } from 'react-router'
import { LoginPage } from '../features/auth/LoginPage'
import { HomePage } from '../features/home/HomePage'
import { JournalPanel } from '../features/journal/JournalPanel'
import { RequireAuth } from './guards/RequireAuth'
import { AppLayout } from './layouts/AppLayout'
import { AccessDeniedPage } from './pages/AccessDeniedPage'
import { NotFoundPage } from './pages/NotFoundPage'

export const routes: RouteObject[] = [
  { path: '/login', element: <LoginPage /> },
  {
    element: <RequireAuth />,
    children: [
      {
        element: <AppLayout />,
        children: [
          {
            path: '/',
            element: <HomePage />,
            // The journal opens over the landing, so the landing stays mounted beneath it.
            children: [{ path: 'patients/:patientId', element: <JournalPanel /> }],
          },
          // Search lives under the landing scene now; this keeps old links and bookmarks working.
          { path: '/patients', element: <Navigate to="/#patients" replace /> },
          // The access log lives inside the journal, so choosing a patient shows both.
          { path: '/patients/:patientId/access-log', element: <Navigate to=".." replace /> },
          // Inside the guard so a signed-in user keeps the header on a bad URL.
          { path: '*', element: <NotFoundPage /> },
        ],
      },
    ],
  },
  { path: '/access-denied', element: <AccessDeniedPage /> },
]
