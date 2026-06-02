import type { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import { config } from '../../config/env'
import { db } from '../../database/db'

export type UserRole = 'admin_general' | 'provider' | 'customer' | 'warehouse'

export interface AuthenticatedUser {
  id: string
  email: string
  name: string
  role: UserRole
  phone?: string | null
  payment_gateway?: string | null
  payment_config?: Record<string, any> | null
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser
    }
  }
}

const getTokenFromHeader = (authorization?: string) => {
  if (!authorization) return null
  if (!authorization.toLowerCase().startsWith('bearer ')) return null
  return authorization.slice(7).trim()
}

export const generateAccessToken = (userId: string) => {
  if (!config.auth.jwtSecret) {
    throw new Error('JWT_SECRET no configurado')
  }

  const secret = config.auth.jwtSecret as jwt.Secret
  const expiresIn = config.auth.jwtExpiresIn as jwt.SignOptions['expiresIn']
  const signOptions: jwt.SignOptions = {
    expiresIn,
  }

  return jwt.sign({ sub: userId }, secret, signOptions)
}

export const requireAuth = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const token = getTokenFromHeader(req.headers.authorization)
    if (!token) {
      return res.status(401).json({ error: 'No autenticado' })
    }

    if (!config.auth.jwtSecret) {
      return res.status(500).json({ error: 'JWT no configurado' })
    }

    const payload = jwt.verify(token, config.auth.jwtSecret as jwt.Secret) as jwt.JwtPayload
    const userId = typeof payload.sub === 'string' ? payload.sub : undefined

    if (!userId) {
      return res.status(401).json({ error: 'Token inválido' })
    }

    const { rows } = await db.query<AuthenticatedUser & { is_active: boolean }>(
      `SELECT id, email, name, role, phone, payment_gateway, payment_config, is_active
       FROM users
       WHERE id = $1
       LIMIT 1`,
      [userId]
    )

    const user = rows[0]

    if (!user) {
      return res.status(401).json({ error: 'Usuario no encontrado' })
    }

    if (user.is_active === false && user.role !== 'admin_general') {
      return res.status(403).json({ error: 'Cuenta desactivada. Contacta al administrador.' })
    }

    req.user = user
    next()
  } catch (error) {
    console.error('Error en middleware de autenticación:', error)

    if (error instanceof jwt.TokenExpiredError) {
      return res.status(401).json({ error: 'Token expirado' })
    }

    if (error instanceof jwt.JsonWebTokenError) {
      return res.status(401).json({ error: 'Token inválido' })
    }

    return res.status(500).json({ error: 'Error de autenticación' })
  }
}

export const requireAdmin = (req: Request, res: Response, next: NextFunction) => {
  if (req.user?.role !== 'admin_general') {
    return res.status(403).json({ error: 'No autorizado' })
  }

  next()
}

// --- ALIAS Y NUEVAS FUNCIONALIDADES PARA DOMINIOS DE SEGURIDAD ---

/**
 * Alias de requireAuth para consistencia en nuevos dominios
 */
export const authenticate = requireAuth

/**
 * Middleware de autorización flexible por roles
 */
export const authorize = (allowedRoles: UserRole[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'No autenticado' })
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: 'No autorizado para esta acción' })
    }

    next()
  }
}
