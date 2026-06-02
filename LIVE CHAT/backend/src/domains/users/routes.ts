import { Router } from 'express'
import { userController } from './controller'
import { healthController } from './health.controller'
import { requireAuth, requireAdmin } from '../../../api/middleware/auth'

const router = Router()

// --- RUTAS PÚBLICAS ---
router.get('/public/payment-contacts', userController.getPaymentContacts)
router.get('/public/branding/:id', userController.getBranding)

// --- RUTAS PROTEGIDAS ---
const authRouter = Router()
authRouter.use(requireAuth)

authRouter.patch('/:id', userController.update)
authRouter.put('/:id/ifttt-config', userController.updateIftttConfig)
authRouter.delete('/:id/ifttt-config', userController.deleteIftttConfig)
authRouter.get('/health', healthController.checkProviderHealth)
authRouter.post('/test-alarm', userController.testAlarm)
authRouter.post('/settings/pin', userController.setSettingsPin)


// --- RUTAS ADMIN ---
const adminRouter = Router()
adminRouter.use(requireAuth, requireAdmin)

adminRouter.get('/', userController.list)
adminRouter.post('/optimize', userController.optimize)

router.use('/', authRouter)
router.use('/', adminRouter)

export default router
