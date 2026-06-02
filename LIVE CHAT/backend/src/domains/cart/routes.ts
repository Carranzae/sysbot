import { Router } from 'express'
import { cartController } from './controller'
import { requireAuth } from '../../../api/middleware/auth'

const router = Router()

// Rutas Públicas (Sesión)
router.get('/whatsapp-sync', cartController.getWhatsAppCart)
router.get('/session/:sessionId', cartController.getAnonymous)
router.post('/session/:sessionId', cartController.addAnonymous)
router.put('/session/:sessionId/:productId', cartController.updateAnonymous)
router.delete('/session/:sessionId/:productId', cartController.removeAnonymous)
router.delete('/session/:sessionId', cartController.clearAnonymous)

// Rutas Protegidas (Usuario)
router.get('/user', requireAuth, cartController.getUserCart)
router.post('/user', requireAuth, cartController.addUserCart)
router.delete('/user', requireAuth, cartController.clearUserCart)
router.post('/migrate', requireAuth, cartController.migrate)

export default router
