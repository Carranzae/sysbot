import { Router } from 'express'
import { catalogController } from './controller'
import { requireAuth, requireAdmin } from '../../../api/middleware/auth'

const router = Router()

// Rutas Públicas
router.get('/public', catalogController.list)

// Rutas Protegidas (General)
router.get('/', requireAuth, catalogController.list)

// Rutas Administrativas
router.post('/', requireAuth, requireAdmin, catalogController.create)
router.patch('/:id', requireAuth, requireAdmin, catalogController.update)
router.delete('/:id', requireAuth, requireAdmin, catalogController.delete)

export default router
