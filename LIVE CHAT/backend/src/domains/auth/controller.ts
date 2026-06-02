import { Request, Response } from 'express'
import { authService } from './service'
import { userService } from '../users/service'
import { config } from '../../../config/env'

export class AuthController {
  async register(req: Request, res: Response) {
    try {
      const result = await authService.register(req.body)
      res.status(201).json({ ...result, expiresIn: config.auth.jwtExpiresIn })
    } catch (error: any) {
      res.status(error.message.includes('registrado') ? 409 : 400).json({ error: error.message })
    }
  }

  async login(req: Request, res: Response) {
    try {
      const { email, password } = req.body
      const result = await authService.login(email, password)
      
      // Desencriptar configuración para el usuario
      if (result.user && result.user.payment_config) {
        result.user.payment_config = userService.decryptSensitiveFields(result.user.payment_config)
      }
      
      res.json({ ...result, expiresIn: config.auth.jwtExpiresIn })
    } catch (error: any) {
      res.status(error.message.includes('inválidas') ? 401 : 403).json({ error: error.message })
    }
  }

  async me(req: Request, res: Response) {
    if (!req.user) return res.status(401).json({ error: 'No autenticado' })
    
    // Clonar para no mutar el objeto req.user que viene del middleware
    const user = JSON.parse(JSON.stringify(req.user))
    
    if (user.payment_config) {
      user.payment_config = userService.decryptSensitiveFields(user.payment_config)
    }
    
    res.json({ user })
  }

  async getUser(req: Request, res: Response) {
    try {
      const { id } = req.params
      const isAdmin = (req as any).user?.role === 'admin_general'
      const isSelf = (req as any).user?.id === id

      if (!isAdmin && !isSelf) return res.status(403).json({ error: 'No autorizado' })

      const user = await authService.getUserById(id)
      
      if (user && user.payment_config) {
        user.payment_config = userService.decryptSensitiveFields(user.payment_config)
      }
      
      res.json({ user })
    } catch (error: any) {
      res.status(404).json({ error: error.message })
    }
  }

  async magicLogin(req: Request, res: Response) {
    try {
      const { token } = req.body
      const result = await authService.magicLogin(token)
      res.json({ ...result, expiresIn: config.auth.jwtExpiresIn })
    } catch (error: any) {
      res.status(401).json({ error: error.message })
    }
  }

  async getPaymentConfig(req: Request, res: Response) {
    try {
      const { id } = req.params
      const user = await authService.getPublicPaymentConfig(id)
      res.json({ user })
    } catch (error: any) {
      res.status(404).json({ error: error.message })
    }
  }
}

export const authController = new AuthController()
