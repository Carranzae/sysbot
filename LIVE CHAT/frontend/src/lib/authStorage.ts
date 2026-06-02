const TOKEN_KEY = 'laychat_auth_token'
const USER_KEY  = 'laychat_auth_user'

export const saveAuthSession = (token: string, user: any) => {
  localStorage.setItem(TOKEN_KEY, token)
  localStorage.setItem(USER_KEY, JSON.stringify(user))
}

export const getAuthToken = (): string | null => localStorage.getItem(TOKEN_KEY)

export const getStoredUser = (): any | null => {
  try {
    const raw = localStorage.getItem(USER_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export const clearAuthSession = () => {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(USER_KEY)
}

export const hasActiveSession = () => Boolean(getAuthToken() && getStoredUser())
