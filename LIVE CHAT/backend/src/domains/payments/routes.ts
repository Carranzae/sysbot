import { Router } from 'express'
import { paymentController } from './controller'
import { requireAuth, requireAdmin } from '../../../api/middleware/auth'
import { paymentValidationLimiter } from '../../../api/middleware/rateLimiters'
import rateLimit from 'express-rate-limit'

const router = Router()

const adminLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 10,
  message: 'Demasiadas solicitudes, intenta de nuevo más tarde.',
})

// --- RUTAS PÚBLICAS/WEBHOOKS ---
router.post('/mercadopago/webhook', paymentController.mpWebhook)
router.get('/gmail/callback', paymentController.gmailCallback)
router.post('/mercadopago/create-preference', paymentController.createMPPreference)
router.post('/mercadopago/qr', paymentController.createMPQR)
router.post('/culqi/order', paymentController.createCulqiOrder)
router.post('/culqi/process', paymentController.processCulqiPayment)

// --- RUTAS PROTEGIDAS ---
const protectedRouter = Router()
protectedRouter.use(requireAuth)

protectedRouter.get('/gmail/auth-url', paymentController.getGmailAuthUrl)

protectedRouter.post('/validate', paymentValidationLimiter, paymentController.validate)

// --- RUTAS ADMIN ---
protectedRouter.post('/gmail/scan', adminLimiter, requireAdmin, paymentController.scanGmail)

router.use('/', protectedRouter)

export default router
