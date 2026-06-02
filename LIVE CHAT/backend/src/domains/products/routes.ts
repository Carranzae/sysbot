import { Router } from 'express'
import { productController } from './controller'
import { requireAuth } from '../../../api/middleware/auth'

const router = Router()

// --- RUTAS PÚBLICAS ---
router.get('/public', productController.getPublic)

// --- RUTAS PROTEGIDAS ---
const authRouter = Router()
authRouter.use(requireAuth)

authRouter.get('/', productController.list)
authRouter.get('/trends', productController.getTrends)
authRouter.get('/inventory-health', productController.getInventoryHealth)
authRouter.get('/:id/insights', productController.getMarketInsights)
authRouter.post('/', productController.create)
authRouter.patch('/:id', productController.update)
authRouter.delete('/:id', productController.delete)

// --- RUTAS DEL RADAR SENTINEL ---
authRouter.post('/sentinel/stores', productController.registerCompetitorStore)
authRouter.get('/sentinel/stores', productController.getCompetitorStores)
authRouter.put('/sentinel/stores/:id', productController.updateCompetitorStore)
authRouter.delete('/sentinel/stores/:id', productController.deleteCompetitorStore)
authRouter.post('/sentinel/stores/:id/scan', productController.scanCompetitorStore)

router.use('/', authRouter)

export default router
