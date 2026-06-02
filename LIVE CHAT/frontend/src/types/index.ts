export type UserRole = 'admin_general' | 'admin' | 'provider' | 'customer' | 'warehouse'

export interface User {
  id: string
  name: string
  email: string
  role: UserRole
  phone?: string | null
  created_at?: string
  updated_at?: string
  is_active?: boolean
  logo_url?: string | null
  primary_color?: string | null
  whatsapp_config?: Record<string, any> | null
}

export interface LocalUser extends User {
  password?: string
  provider_password?: string
}
