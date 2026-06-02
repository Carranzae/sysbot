// Configuración de Base de Datos

export const DATABASE_CONFIG = {
  // Supabase
  SUPABASE_URL: process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '',
  SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '',
  
  // Validación
  hasValidCredentials: (): boolean => {
    const url = DATABASE_CONFIG.SUPABASE_URL
    const key = DATABASE_CONFIG.SUPABASE_ANON_KEY
    
    return !!(
      url &&
      key &&
      url !== 'tu_url_de_supabase_aqui' &&
      key !== 'tu_clave_anonima_aqui' &&
      url.startsWith('http')
    )
  },
  
  // Modo local
  USE_LOCAL_STORAGE: true, // Usar localStorage cuando no hay Supabase
  
  // Tablas
  TABLES: {
    USERS: 'users',
    PRODUCTS: 'products',
    CATEGORIES: 'categories',
    ORDERS: 'orders',
  },
} as const

