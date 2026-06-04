import { Router } from 'express'
import { whatsappController } from './controller'
import { requireAuth, requireAdmin } from '../../../api/middleware/auth'

const router = Router()

// --- RUTAS PÚBLICAS (META WEBHOOK) ---
router.get('/webhook', whatsappController.verifyWebhook)
router.post('/webhook', whatsappController.handleWebhook)
router.post('/register-intent', whatsappController.registerIntent)

// --- RUTAS PROTEGIDAS ---
router.post('/test', requireAuth, requireAdmin, whatsappController.testBusiness)
router.get('/web/status', requireAuth, whatsappController.getStatus)
router.post('/web/start', requireAuth, whatsappController.startSession)
router.post('/web/disconnect', requireAuth, whatsappController.disconnect)
router.get('/web/bot-enabled', requireAuth, whatsappController.getBotEnabled)
router.patch('/web/bot-enabled', requireAuth, whatsappController.patchBotEnabled)
router.get('/chats', requireAuth, whatsappController.getChats)
router.post('/chats/pause-statuses', requireAuth, whatsappController.getChatPauseStatuses)
router.get('/chats/:phone', requireAuth, whatsappController.getMessages)
router.get('/chats/:phone/profile', requireAuth, whatsappController.getProfile)
router.get('/chats/:phone/avatar', requireAuth, whatsappController.getAvatar)
router.patch('/chats/:phone/bot-pause', requireAuth, whatsappController.toggleBotPauseForChat)
router.delete('/chats/messages/:id', requireAuth, whatsappController.deleteMessage)
router.delete('/chats/:phone/clear', requireAuth, whatsappController.clearChat)
router.post('/send', requireAuth, whatsappController.sendMessage)
router.get('/web/sessions', whatsappController.getAllSessions)

export default router
