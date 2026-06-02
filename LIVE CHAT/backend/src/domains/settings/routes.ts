import { Router } from 'express'
import { settingsController } from './controller'
import { requireAuth, requireAdmin } from '../../../api/middleware/auth'

const router = Router()

router.get('/public', settingsController.getPublic)
router.get('/global', settingsController.getGlobal) // <--- PÚBLICO
router.patch('/global', requireAuth, requireAdmin, settingsController.updateGlobal)
router.get('/credentials', requireAuth, requireAdmin, settingsController.getCredentials)
router.patch('/credentials', requireAuth, requireAdmin, settingsController.updateCredentials)
router.patch('/maintenance', requireAuth, requireAdmin, settingsController.updateMaintenance)
router.get('/ad-video', requireAuth, requireAdmin, settingsController.getAdVideo)
router.patch('/ad-video', requireAuth, requireAdmin, settingsController.updateAdVideo)
router.get('/nps-analytics', requireAuth, settingsController.getNpsAnalytics)
router.get('/system-health', requireAuth, requireAdmin, settingsController.getSystemHealth)

export default router
