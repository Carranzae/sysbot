import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { db } from '../../../database/db'
import { config } from '../../../config/env'
import { logger } from '../../../api/utils/logger'
import { AuthenticatedUser, generateAccessToken } from '../../../api/middleware/auth'

export type DbUser = AuthenticatedUser & { password_hash?: string | null, is_active?: boolean }

export class AuthService {
  private readonly SALT_ROUNDS = 10

  async register(data: { name: string; email: string; password?: string; phone?: string; role?: string }) {
    const normalizedEmail = data.email.trim().toLowerCase()
    
    // 1. Check existing
    const { rows: existing } = await db.query('SELECT id FROM users WHERE email = $1', [normalizedEmail])
    if (existing.length) throw new Error('El email ya está registrado')

    // 2. Determine role (first user is admin)
    const { rows: countRows } = await db.query('SELECT COUNT(*) FROM users')
    const isFirst = parseInt(countRows[0].count) === 0
    const role = isFirst ? 'admin_general' : (data.role || 'customer')

    // 3. Hash password
    const hash = data.password ? bcrypt.hashSync(data.password, this.SALT_ROUNDS) : null

    // 4. Insert
    const { rows } = await db.query<AuthenticatedUser>(
      `INSERT INTO users (name, email, phone, role, password_hash)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, email, name, role, phone, payment_gateway, payment_config`,
      [data.name.trim(), normalizedEmail, data.phone || null, role, hash]
    )

    const user = rows[0]
    const token = generateAccessToken(user.id)
    
    logger.info('Usuario registrado', { userId: user.id, role })
    return { user: this.sanitizeUser(user), token }
  }

  async login(email: string, password?: string) {
    const normalizedEmail = email.trim().toLowerCase()
    const { rows } = await db.query<DbUser>(
      `SELECT id, email, name, role, phone, payment_gateway, payment_config, password_hash, is_active
       FROM users WHERE email = $1 LIMIT 1`,
      [normalizedEmail]
    )
    const user = rows[0]

    if (!user || !user.password_hash || !password) throw new Error('Credenciales inválidas')
    
    if (!bcrypt.compareSync(password, user.password_hash)) {
      logger.warn('Intento de login fallido', { email: normalizedEmail })
      throw new Error('Credenciales inválidas')
    }

    if (user.is_active === false && user.role !== 'admin_general') {
      throw new Error('Cuenta inactiva')
    }

    const token = generateAccessToken(user.id)
    const { password_hash, ...safeUser } = user
    
    logger.info('Usuario autenticado', { userId: user.id })
    return { user: this.sanitizeUser(safeUser), token }
  }

  async magicLogin(token: string) {
    try {
      const decoded = jwt.verify(token, config.auth.jwtSecret) as any
      if (decoded.type !== 'magic_link') throw new Error('Token inválido')

      const { rows } = await db.query<AuthenticatedUser>(
        `SELECT id, email, name, role, phone, payment_gateway, payment_config FROM users WHERE id = $1`,
        [decoded.id]
      )
      if (!rows.length) throw new Error('Usuario no encontrado')

      const user = rows[0]
      const accessToken = generateAccessToken(user.id)
      return { user: this.sanitizeUser(user), token: accessToken }
    } catch (e: any) {
      logger.error('Magic Login Error:', e as any)
      throw new Error('Enlace expirado o inválido')
    }
  }

  async getUserById(id: string) {
    const { rows } = await db.query<AuthenticatedUser>(
      `SELECT id, email, name, role, phone, payment_gateway, payment_config FROM users WHERE id = $1`,
      [id]
    )
    if (!rows.length) throw new Error('Usuario no encontrado')
    return this.sanitizeUser(rows[0])
  }

  async getPublicPaymentConfig(id: string) {
    const { rows } = await db.query(
      `SELECT id, name, phone, role, payment_gateway, payment_config, qr_code FROM users WHERE id = $1`,
      [id]
    )
    if (!rows.length) throw new Error('Usuario no encontrado')
    
    const user = rows[0]
    // 🛡️ DESENCRIPTACIÓN DE ÉLITE: Asegurar que el Checkout vea los datos reales
    const { userService } = await import('../users/service')
    if (user.payment_config) {
      user.payment_config = userService.decryptSensitiveFields(user.payment_config)
    }
    
    return user
  }

  private sanitizeUser(user: any) {
    const { password_hash, ...safe } = user
    return {
      ...safe,
      payment_config: safe.payment_config || {}
    }
  }
}

export const authService = new AuthService()
