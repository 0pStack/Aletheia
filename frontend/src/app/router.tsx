import type { RouteObject } from 'react-router'
import { AccessLogPage } from '../features/access-log/AccessLogPage'
import { LoginPage } from '../features/auth/LoginPage'
import { HomePage } from '../features/home/HomePage'
import { JournalPage } from '../features/journal/JournalPage'
import { PatientSearchPage } from '../features/patients/PatientSearchPage'
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
          { index: true, element: <HomePage /> },
          { path: '/patients', element: <PatientSearchPage /> },
          { path: '/patients/:patientId', element: <JournalPage /> },
          { path: '/patients/:patientId/access-log', element: <AccessLogPage /> },
          // Inside the guard so a signed-in user keeps the header on a bad URL.
          { path: '*', element: <NotFoundPage /> },
        ],
      },
    ],
  },
  { path: '/access-denied', element: <AccessDeniedPage /> },
]
