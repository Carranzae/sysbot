import { Router } from 'express'
import { notificationService } from '../../services/notification.service'
import { requireAuth } from '../middleware/auth'

const router = Router()

// Obtener mis notificaciones visuales
router.get('/', requireAuth, async (req: any, res) => {
  try {
    const isAdmin = ['admin_general', 'admin', 'superadmin', 'owner'].includes(req.user.role)
    const userId = isAdmin ? null : req.user.id
    const notifications = await notificationService.listUiNotifications(userId)
    res.json({ success: true, notifications })
  } catch (e: any) {
    res.status(500).json({ error: e.message })
  }
})

// Marcar una como leída
router.patch('/:id/read', requireAuth, async (req, res) => {
  try {
    await notificationService.markAsRead(req.params.id)
    res.json({ success: true })
  } catch (e: any) {
    res.status(500).json({ error: e.message })
  }
})

export default router
