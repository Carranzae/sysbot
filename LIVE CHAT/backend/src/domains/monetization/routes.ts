import { Router } from 'express'
import { monetizationService } from './service'
import { logger } from '../../../api/utils/logger'

const router = Router()

// Middleware de seguridad para asegurar que solo el admin general acceda
const isAdminGeneral = (req: any, res: any, next: any) => {
  const role = req.user?.role
  console.log(`[MON AUTH] Rol recibido: "${role}" | Usuario: ${req.user?.email}`)

  const adminRoles = ['admin_general', 'admin', 'superadmin', 'owner']
  if (!role || !adminRoles.includes(role)) {
    console.log(`[MON AUTH] ❌ Bloqueado. Rol "${role}" no permitido.`)
    return res.status(403).json({ error: 'Acceso restringido a Administradores', rol_actual: role })
  }
  next()
}

router.get('/stats', isAdminGeneral, async (req, res) => {
  try {
    const stats = await monetizationService.getAdminStats()
    res.json(stats)
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
})

router.get('/ledger', isAdminGeneral, async (req, res) => {
  try {
    const { providerId, limit, page } = req.query
    const ledger = await monetizationService.getLedger({ 
      providerId: providerId as string, 
      limit: Number(limit) || 50, 
      page: Number(page) || 1 
    })
    res.json(ledger)
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
})

export default router
