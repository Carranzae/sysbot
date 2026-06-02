import { Router } from 'express'
import { authController } from './controller'
import { requireAuth } from '../../../api/middleware/auth'
import { loginRateLimiter } from '../../../api/middleware/rateLimiters'

const router = Router()

router.post('/register', authController.register)
router.post('/login', loginRateLimiter, authController.login)
router.get('/me', requireAuth, authController.me)
router.get('/user/:id', requireAuth, authController.getUser)
router.post('/magic-login', authController.magicLogin)
router.get('/user/:id/payment-config', authController.getPaymentConfig)

export default router
