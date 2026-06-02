import { Router } from 'express'
import { orderController } from './controller'
import { requireAuth } from '../../../api/middleware/auth'

const router = Router()

// --- RUTAS PÚBLICAS ---
router.get('/public', orderController.getPublicOrder)
router.post('/', orderController.createOrder)

// --- RUTAS PROTEGIDAS ---
const protectedRouter = Router()
protectedRouter.use(requireAuth)

protectedRouter.get('/', orderController.listOrders)
protectedRouter.patch('/:id', orderController.updateOrder)
protectedRouter.delete('/:id', orderController.deleteOrder)

router.use('/', protectedRouter)

export default router
