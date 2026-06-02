import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { config } from '../config/env'
import { db } from '../database/db'
import { logger } from '../api/utils/logger'

export const magicLinkService = {
  /**
   * Genera un token de login de un solo uso que expira en 24 horas.
   */
  generateToken(userId: string): string {
    return jwt.sign({ id: userId, type: 'magic_link' }, config.auth.jwtSecret, { expiresIn: '24h' })
  },

  /**
   * Crea o recupera un usuario a partir de su teléfono (para invitados)
   * y genera su link de acceso.
   */
  async getOrCreateMagicLink(phone: string, name?: string): Promise<string> {
    try {
      // Buscar si el usuario ya existe por teléfono
      let { rows } = await db.query('SELECT id FROM users WHERE phone = $1 LIMIT 1', [phone])
      let userId: string

      if (rows.length === 0) {
        // Crear usuario "invitado" si no existe
        const email = `guest_${phone}@atines.pe`
        const randomPassword = Math.random().toString(36).slice(-10) + Date.now().toString(36)
        const passwordHash = bcrypt.hashSync(randomPassword, 10)
        
        const { rows: newUsers } = await db.query(
          'INSERT INTO users (name, email, phone, role, password_hash) VALUES ($1, $2, $3, $4, $5) RETURNING id',
          [name || 'Invitado', email, phone, 'customer', passwordHash]
        )
        userId = newUsers[0].id
      } else {
        userId = rows[0].id
      }

      const token = this.generateToken(userId)
      // En producción, esto apuntaría a tu dominio real
      return `https://atines.pe/login/magic?token=${token}`
    } catch (error: any) {
      logger.error('Error generando Magic Link:', { error: error.message })
      throw error
    }
  }
}
