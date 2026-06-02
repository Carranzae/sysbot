import crypto from 'crypto'

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 16
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY

if (!ENCRYPTION_KEY && process.env.NODE_ENV === 'production') {
  throw new Error('CRÍTICO: ENCRYPTION_KEY no está configurada en el entorno.')
}

// Generar la llave de 32 bytes de forma segura
const KEY = crypto.scryptSync(ENCRYPTION_KEY || 'default-temp-key-change-me', 'atines-salt-2024', 32)

export const encryption = {
  encrypt(text: string): string {
    if (!text) return ''
    const iv = crypto.randomBytes(IV_LENGTH)
    const cipher = crypto.createCipheriv(ALGORITHM, KEY, iv)
    let encrypted = cipher.update(text, 'utf8', 'hex')
    encrypted += cipher.final('hex')
    const authTag = cipher.getAuthTag().toString('hex')
    return `${iv.toString('hex')}:${authTag}:${encrypted}`
  },

  decrypt(text: string): string {
    if (!text || !text.includes(':')) return text
    try {
      const [ivHex, authTagHex, encryptedText] = text.split(':')
      if (!ivHex || !authTagHex || !encryptedText) return text

      const iv = Buffer.from(ivHex, 'hex')
      const authTag = Buffer.from(authTagHex, 'hex')
      
      // Validar longitud del tag de autenticación (AES-GCM espera 16 bytes usualmente)
      if (authTag.length === 0) {
        return text
      }

      const decipher = crypto.createDecipheriv(ALGORITHM, KEY, iv)
      decipher.setAuthTag(authTag)
      let decrypted = decipher.update(encryptedText, 'hex', 'utf8')
      decrypted += decipher.final('utf8')
      return decrypted
    } catch (error) {
      // Si falla, no rompemos la app, devolvemos el texto original por seguridad
      return text
    }
  }
}
