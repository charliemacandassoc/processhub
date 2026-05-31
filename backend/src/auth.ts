import { Request, Response, NextFunction } from 'express'
import jwt, { JwtHeader, SigningKeyCallback } from 'jsonwebtoken'
import jwksClient from 'jwks-rsa'

const TENANT_ID = process.env.ENTRA_TENANT_ID
const CLIENT_ID = process.env.ENTRA_CLIENT_ID

if (!TENANT_ID || !CLIENT_ID) {
  console.warn('[auth] ENTRA_TENANT_ID / ENTRA_CLIENT_ID not set — JWT validation disabled in dev mode')
}

const client = TENANT_ID
  ? jwksClient({ jwksUri: `https://login.microsoftonline.com/${TENANT_ID}/discovery/v2.0/keys`, cache: true, rateLimit: true })
  : null

function getKey(header: JwtHeader, callback: SigningKeyCallback) {
  if (!client) return callback(null, 'dev-secret')
  client.getSigningKey(header.kid, (err, key) => {
    if (err) return callback(err)
    callback(null, key?.getPublicKey())
  })
}

export interface AuthRequest extends Request {
  user?: { sub: string; name: string; email: string; roles: string[] }
}

export function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
  if (!TENANT_ID || !CLIENT_ID) {
    // Dev mode — skip validation
    req.user = { sub: 'dev', name: 'Dev User', email: 'dev@localhost', roles: ['ProcessAdmin'] }
    return next()
  }

  const authHeader = req.headers.authorization
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing bearer token' })
  }

  const token = authHeader.slice(7)
  jwt.verify(
    token,
    getKey,
    {
      audience: CLIENT_ID,
      issuer: `https://login.microsoftonline.com/${TENANT_ID}/v2.0`,
      algorithms: ['RS256'],
    },
    (err, decoded) => {
      if (err) return res.status(401).json({ error: 'Invalid token', detail: err.message })
      const claims = decoded as Record<string, unknown>
      req.user = {
        sub: String(claims.sub ?? ''),
        name: String(claims.name ?? ''),
        email: String(claims.preferred_username ?? claims.email ?? ''),
        roles: (claims.roles as string[]) ?? [],
      }
      next()
    }
  )
}

export function requireAdmin(req: AuthRequest, res: Response, next: NextFunction) {
  requireAuth(req, res, () => {
    if (!req.user?.roles.includes('ProcessAdmin')) {
      return res.status(403).json({ error: 'ProcessAdmin role required' })
    }
    next()
  })
}
