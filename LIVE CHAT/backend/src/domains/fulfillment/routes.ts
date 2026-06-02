import { Router } from 'express'
import { fulfillmentController } from './controller'
import { requireAuth } from '../../../api/middleware/auth'

const router = Router()
router.use(requireAuth)

// --- AGENCIAS ---
router.get('/agencies', fulfillmentController.getAgencies)
router.post('/agencies', fulfillmentController.createAgency)
router.put('/agencies/:id', fulfillmentController.updateAgency)
router.delete('/agencies/:id', fulfillmentController.deleteAgency)

// --- OPERADORES ---
router.get('/operators', fulfillmentController.getOperators)
router.post('/operators', fulfillmentController.createOperator)
router.patch('/operators/:id', fulfillmentController.updateOperator)
router.delete('/operators/:id', fulfillmentController.deleteOperator)

// --- PEDIDOS / CHECKLIST ---
router.get('/orders', fulfillmentController.getWarehouseOrders)
router.get('/orders/global', fulfillmentController.getWarehouseOrders)
router.get('/orders/provider', fulfillmentController.getProviderOrders)
router.patch('/orders/:id', fulfillmentController.updateStatus)
router.post('/orders/:id/sync', fulfillmentController.syncTracking)

// --- IA SCANNER ---
router.post('/scan-label', fulfillmentController.scanLabel)

export default router
