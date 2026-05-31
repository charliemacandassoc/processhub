// White-label configuration — all values come from env vars so any client
// deployment can rebrand without touching source code.
export const brand = {
  appName: import.meta.env.VITE_APP_NAME ?? 'Process Hub',
  logoUrl: import.meta.env.VITE_LOGO_URL ?? '/logo.svg',
  primaryColor: import.meta.env.VITE_PRIMARY_COLOR ?? '#0078d4',
  tenantName: import.meta.env.VITE_TENANT_NAME ?? 'Your Organisation',
}

export const msalConfig = {
  clientId: import.meta.env.VITE_ENTRA_CLIENT_ID as string,
  tenantId: import.meta.env.VITE_ENTRA_TENANT_ID as string,
}
