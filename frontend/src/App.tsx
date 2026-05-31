import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthenticatedTemplate, UnauthenticatedTemplate, useMsal } from '@azure/msal-react'
import { InteractionStatus } from '@azure/msal-browser'
import { loginRequest } from './authConfig'
import { msalConfig } from './config'
import { useProcessStore } from './store/useProcessStore'
import { NavBar } from './components/NavBar'
import { AppLayout } from './components/AppLayout'
import { LoginPage } from './pages/LoginPage'
import { Inventory } from './pages/Inventory'
import { ProcessViewer } from './pages/ProcessViewer'
import { Admin } from './pages/Admin'
import { AdminProcessEditor } from './pages/AdminProcessEditor'
import { RequireAdmin } from './components/RequireAdmin'

// When no Entra client ID is configured, skip MSAL entirely and render the
// app as a local dev admin. This mirrors the backend's dev-mode bypass.
const DEV_MODE = !msalConfig.clientId

function AppRoutes() {
  return (
    <BrowserRouter>
      <NavBar />
      <AppLayout>
        <Routes>
          <Route path="/" element={<Navigate to="/inventory" replace />} />
          <Route path="/inventory" element={<Inventory />} />
          <Route path="/process/:id" element={<ProcessViewer />} />
          <Route
            path="/admin"
            element={
              <RequireAdmin>
                <Admin />
              </RequireAdmin>
            }
          />
          <Route
            path="/admin/process/:id"
            element={
              <RequireAdmin>
                <AdminProcessEditor />
              </RequireAdmin>
            }
          />
          <Route path="*" element={<Navigate to="/inventory" replace />} />
        </Routes>
      </AppLayout>
    </BrowserRouter>
  )
}

function MsalApp() {
  const { instance, accounts, inProgress } = useMsal()
  const setUser = useProcessStore((s) => s.setUser)

  useEffect(() => {
    if (accounts.length === 0 || inProgress !== InteractionStatus.None) return

    instance
      .acquireTokenSilent({ ...loginRequest, account: accounts[0] })
      .then((result) => {
        const claims = result.idTokenClaims as Record<string, unknown>
        const roles = (claims?.roles as string[]) ?? []
        setUser(
          {
            name: accounts[0].name ?? accounts[0].username,
            email: accounts[0].username,
            isAdmin: roles.includes('ProcessAdmin'),
          },
          result.accessToken
        )
      })
      .catch(() => {
        instance.loginRedirect(loginRequest)
      })
  }, [accounts, inProgress, instance, setUser])

  return (
    <>
      <UnauthenticatedTemplate>
        <LoginPage />
      </UnauthenticatedTemplate>
      <AuthenticatedTemplate>
        <AppRoutes />
      </AuthenticatedTemplate>
    </>
  )
}

function DevApp() {
  const setUser = useProcessStore((s) => s.setUser)

  useEffect(() => {
    setUser({ name: 'Dev User', email: 'dev@localhost', isAdmin: true }, 'dev-token')
  }, [setUser])

  return <AppRoutes />
}

export default function App() {
  return DEV_MODE ? <DevApp /> : <MsalApp />
}
