import { Router } from 'express'
import { webhookController } from './controller'

const router = Router()

router.post('/mercadopago/:providerId', webhookController.mercadoPago)
router.post('/izipay/:providerId', webhookController.izipay)

export default router
