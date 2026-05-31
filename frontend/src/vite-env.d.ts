/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_APP_NAME: string
  readonly VITE_LOGO_URL: string
  readonly VITE_PRIMARY_COLOR: string
  readonly VITE_TENANT_NAME: string
  readonly VITE_ENTRA_CLIENT_ID: string
  readonly VITE_ENTRA_TENANT_ID: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
