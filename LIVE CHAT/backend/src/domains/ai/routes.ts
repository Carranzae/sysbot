import { Router } from 'express'
import { aiController } from './controller'

const router = Router()

router.post('/chat', aiController.chat)
router.post('/chat-stream', aiController.chatStream)

export default router
