import { Router } from 'express'
import { subscriptionService } from './service'

const router = Router()

const isAdmin = (req: any, res: any, next: any) => {
  const role = req.user?.role
  console.log(`[SUBS AUTH] Rol recibido: "${role}" | Usuario: ${req.user?.email}`)
  
  const adminRoles = ['admin_general', 'admin', 'superadmin', 'owner']
  if (!role || !adminRoles.includes(role)) {
    console.log(`[SUBS AUTH] ❌ Acceso bloqueado. Rol "${role}" no autorizado.`)
    return res.status(403).json({ error: 'No autorizado', rol_actual: role })
  }
  next()
}

// Obtener todos los planes
router.get('/plans', async (req, res) => {
  try {
    const plans = await subscriptionService.getPlans()
    res.json({ plans })
  } catch (e: any) { res.status(500).json({ error: e.message }) }
})

// Listar TODAS las suscripciones de proveedores (tabla de control del Admin)
router.get('/all', isAdmin, async (req, res) => {
  try {
    const subscriptions = await subscriptionService.getAllProviderSubscriptions()
    res.json({ subscriptions })
  } catch (e: any) { res.status(500).json({ error: e.message }) }
})

// Ver suscripción de un proveedor
router.get('/provider/:providerId', isAdmin, async (req, res) => {
  try {
    const sub = await subscriptionService.getProviderSubscription(req.params.providerId)
    res.json({ subscription: sub })
  } catch (e: any) { res.status(500).json({ error: e.message }) }
})

// Asignar plan a un proveedor (Admin)
router.post('/assign', isAdmin, async (req, res) => {
  try {
    const { providerId, planSlug, durationDays } = req.body
    if (!providerId || !planSlug) return res.status(400).json({ error: 'providerId y planSlug requeridos' })
    const result = await subscriptionService.assignPlan(providerId, planSlug, durationDays)
    res.json({ success: true, ...result })
  } catch (e: any) { res.status(500).json({ error: e.message }) }
})

// Activar trial
router.post('/trial', isAdmin, async (req, res) => {
  try {
    const { providerId, planSlug, trialDays } = req.body
    await subscriptionService.activateTrial(providerId, planSlug, trialDays)
    res.json({ success: true })
  } catch (e: any) { res.status(500).json({ error: e.message }) }
})

// Suspender manualmente
router.post('/suspend/:providerId', isAdmin, async (req, res) => {
  try {
    await subscriptionService.suspendSubscription(req.params.providerId)
    res.json({ success: true })
  } catch (e: any) { res.status(500).json({ error: e.message }) }
})

// Reactivar manualmente
router.post('/reactivate/:providerId', isAdmin, async (req, res) => {
  try {
    await subscriptionService.reactivateSubscription(req.params.providerId)
    res.json({ success: true })
  } catch (e: any) { res.status(500).json({ error: e.message }) }
})

// Eliminar suscripción (Reset a modo básico)
router.delete('/provider/:providerId', isAdmin, async (req, res) => {
  try {
    await subscriptionService.deleteSubscription(req.params.providerId)
    res.json({ success: true })
  } catch (e: any) { res.status(500).json({ error: e.message }) }
})

// Actualizar configuración de un plan
router.patch('/plans/:id', isAdmin, async (req, res) => {
  try {
    const plan = await subscriptionService.updatePlan(req.params.id, req.body)
    res.json({ success: true, plan })
  } catch (e: any) { res.status(500).json({ error: e.message }) }
})

export default router
