import { Router } from 'express'
import { inventoryController } from './controller'

const router = Router()

router.post('/decrement', inventoryController.decrement)
router.post('/increment', inventoryController.increment)
router.post('/reserve', inventoryController.reserve)

export default router
