import { Router } from 'express'
import { securityController } from './controller'
import { authenticate, authorize } from '../../../api/middleware/auth'

const router = Router()

// Registro de eventos (Público/Cualquier usuario logueado para reportar DevTools/Ataques)
router.post('/log', securityController.logEvent)

// Configuración y Logs (Solo Admin)
router.get('/public-config', securityController.getPublicConfig)
router.get('/events', authenticate, authorize(['admin_general']), securityController.getEvents)
router.get('/config', authenticate, authorize(['admin_general']), securityController.getConfig)
router.post('/config', authenticate, authorize(['admin_general']), securityController.updateConfig)

export default router
