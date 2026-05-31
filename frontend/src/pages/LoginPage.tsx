import { useMsal } from '@azure/msal-react'
import { loginRequest } from '../authConfig'
import { brand } from '../config'

export function LoginPage() {
  const { instance } = useMsal()

  return (
    <div className="login-page">
      <div className="login-card">
        {brand.logoUrl && <img src={brand.logoUrl} alt={brand.appName} className="login-logo" />}
        <h1>{brand.appName}</h1>
        <p>Sign in with your {brand.tenantName} Microsoft 365 account to continue.</p>
        <button
          className="btn btn-primary"
          onClick={() => instance.loginRedirect(loginRequest)}
        >
          Sign in with Microsoft
        </button>
      </div>
    </div>
  )
}
