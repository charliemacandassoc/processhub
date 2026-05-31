import { Configuration, LogLevel, PopupRequest } from '@azure/msal-browser'
import { msalConfig } from './config'

export const msalConfiguration: Configuration = {
  auth: {
    clientId: msalConfig.clientId,
    authority: `https://login.microsoftonline.com/${msalConfig.tenantId}`,
    redirectUri: window.location.origin,
    postLogoutRedirectUri: window.location.origin,
  },
  cache: {
    cacheLocation: 'sessionStorage',
    storeAuthStateInCookie: false,
  },
  system: {
    loggerOptions: {
      loggerCallback: (level, message, containsPii) => {
        if (containsPii) return
        if (level === LogLevel.Error) console.error(message)
      },
    },
  },
}

export const loginRequest: PopupRequest = {
  scopes: [`api://${msalConfig.clientId}/user_impersonation`],
}
