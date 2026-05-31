import { Link, useLocation } from 'react-router-dom'
import { useMsal } from '@azure/msal-react'
import { useProcessStore } from '../store/useProcessStore'
import { brand } from '../config'

export function NavBar() {
  const { instance } = useMsal()
  const user = useProcessStore((s) => s.user)
  const location = useLocation()

  const initials = user?.name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

  return (
    <nav className="navbar">
      <div className="navbar-brand">
        {brand.logoUrl
          ? <img src={brand.logoUrl} alt={brand.appName} className="navbar-logo" />
          : <span className="navbar-app-name">{brand.appName}</span>}
      </div>

      <div className="navbar-links">
        <Link
          to="/inventory"
          className={`nav-link ${location.pathname === '/inventory' ? 'active' : ''}`}
        >
          Inventory
        </Link>
        {user?.isAdmin && (
          <Link
            to="/admin"
            className={`nav-link ${location.pathname.startsWith('/admin') ? 'active' : ''}`}
          >
            Admin
          </Link>
        )}
      </div>

      <div className="navbar-user">
        <span className="user-name">{user?.name}</span>
        <div className="avatar" title={user?.email}>
          {initials}
        </div>
        <button
          className="btn btn-ghost btn-sm"
          onClick={() => instance.logoutRedirect()}
        >
          Sign out
        </button>
      </div>
    </nav>
  )
}
