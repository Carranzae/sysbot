import { db } from '../../../database/db'
import { logger } from '../../../api/utils/logger'

export class SubscriptionService {

  // Obtener todos los planes disponibles
  async getPlans() {
    const { rows } = await db.query(
      'SELECT * FROM subscription_plans WHERE is_active = true ORDER BY sort_order ASC'
    )
    return rows
  }

  // Obtener TODAS las suscripciones de proveedores (para el Admin)
  async getAllProviderSubscriptions() {
    const { rows } = await db.query(`
      SELECT 
        u.id as provider_id,
        u.name as provider_name,
        u.email as provider_email,
        u.phone as provider_phone,
        u.is_active,
        ps.status as subscription_status,
        ps.starts_at,
        ps.expires_at,
        ps.updated_at,
        sp.name as plan_name,
        sp.slug as plan_slug,
        sp.price as plan_price,
        sp.commission_rate,
        CASE 
          WHEN ps.expires_at IS NULL THEN 'sin_plan'
          WHEN ps.expires_at < NOW() THEN 'vencido'
          WHEN ps.expires_at < NOW() + INTERVAL '3 days' THEN 'por_vencer'
          ELSE 'al_dia'
        END as payment_status
      FROM users u
      LEFT JOIN provider_subscriptions ps ON u.id = ps.provider_id
      LEFT JOIN subscription_plans sp ON ps.plan_id = sp.id
      WHERE u.role = 'provider'
      ORDER BY ps.expires_at ASC NULLS FIRST
    `)
    return rows
  }

  // Obtener la suscripción activa de un proveedor
  async getProviderSubscription(providerId: string) {
    const { rows } = await db.query(`
      SELECT ps.*, sp.name as plan_name, sp.slug as plan_slug, 
             sp.commission_rate, sp.max_products, sp.features, sp.price
      FROM provider_subscriptions ps
      JOIN subscription_plans sp ON ps.plan_id = sp.id
      WHERE ps.provider_id = $1
    `, [providerId])
    return rows[0] || null
  }

  // Asignar o cambiar el plan de un proveedor (Solo Admin)
  async assignPlan(providerId: string, planSlug: string, durationDays: number = 30) {
    const { rows: plans } = await db.query(
      'SELECT * FROM subscription_plans WHERE slug = $1 AND is_active = true', [planSlug]
    )
    if (!plans.length) throw new Error(`Plan "${planSlug}" no encontrado`)
    const plan = plans[0]

    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + durationDays)

    // Upsert: si ya tiene suscripción la actualiza, si no la crea
    await db.query(`
      INSERT INTO provider_subscriptions (provider_id, plan_id, status, starts_at, expires_at)
      VALUES ($1, $2, 'active', NOW(), $3)
      ON CONFLICT (provider_id) DO UPDATE SET
        plan_id = $2,
        status = 'active',
        starts_at = NOW(),
        expires_at = $3,
        updated_at = NOW()
    `, [providerId, plan.id, expiresAt])

    // Actualizar commission_rate en users según el plan
    await db.query(
      'UPDATE users SET commission_rate = $1, commission_mode = $2 WHERE id = $3',
      [plan.commission_rate, 'percentage', providerId]
    )

    logger.info(`📋 [SUSCRIPCIÓN] Proveedor ${providerId} asignado a plan ${plan.name} hasta ${expiresAt.toLocaleDateString()}`)
    return { plan, expiresAt }
  }

  // Actualizar configuración de un plan (Admin)
  async updatePlan(id: string, data: any) {
    const updates: string[] = []
    const values: any[] = []
    let idx = 1

    if (data.name) { updates.push(`name = $${idx++}`); values.push(data.name) }
    if (data.price !== undefined) { updates.push(`price = $${idx++}`); values.push(data.price) }
    if (data.commission_rate !== undefined) { updates.push(`commission_rate = $${idx++}`); values.push(data.commission_rate) }
    if (data.features !== undefined) { updates.push(`features = $${idx++}`); values.push(JSON.stringify(data.features)) }
    if (data.is_active !== undefined) { updates.push(`is_active = $${idx++}`); values.push(data.is_active) }

    if (updates.length === 0) throw new Error('Nada que actualizar')

    const query = `UPDATE subscription_plans SET ${updates.join(', ')} WHERE id = $${idx} RETURNING *`
    values.push(id)
    const { rows } = await db.query(query, values)
    return rows[0]
  }

  // Activar período de prueba gratuita
  async activateTrial(providerId: string, planSlug: string = 'pro', trialDays: number = 14) {
    const { rows: plans } = await db.query(
      'SELECT * FROM subscription_plans WHERE slug = $1', [planSlug]
    )
    if (!plans.length) throw new Error('Plan no encontrado')
    const plan = plans[0]

    const trialEndsAt = new Date()
    trialEndsAt.setDate(trialEndsAt.getDate() + trialDays)

    await db.query(`
      INSERT INTO provider_subscriptions (provider_id, plan_id, status, expires_at, trial_ends_at)
      VALUES ($1, $2, 'trial', $3, $3)
      ON CONFLICT (provider_id) DO UPDATE SET
        plan_id = $2, status = 'trial', expires_at = $3, trial_ends_at = $3, updated_at = NOW()
    `, [providerId, plan.id, trialEndsAt])

    await db.query('UPDATE users SET commission_rate = $1 WHERE id = $2', [plan.commission_rate, providerId])
    logger.info(`🎁 [SUSCRIPCIÓN] Trial ${trialDays}d activado para ${providerId}`)
  }

  // Cancelar/suspender suscripción
  async suspendSubscription(providerId: string) {
    await db.query(`
      UPDATE provider_subscriptions SET status = 'suspended', updated_at = NOW()
      WHERE provider_id = $1
    `, [providerId])
    await db.query('UPDATE users SET is_active = false WHERE id = $1', [providerId])
    logger.info(`🚫 [SUSCRIPCIÓN] Proveedor ${providerId} suspendido`)
  }

  async reactivateSubscription(providerId: string) {
    await db.query(`
      UPDATE provider_subscriptions SET status = 'active', updated_at = NOW()
      WHERE provider_id = $1
    `, [providerId])
    await db.query('UPDATE users SET is_active = true WHERE id = $1', [providerId])
    logger.info(`✅ [SUSCRIPCIÓN] Proveedor ${providerId} reactivado`)
  }

  // Eliminar suscripción por completo (Resetear a modo básico)
  async deleteSubscription(providerId: string) {
    await db.query('DELETE FROM provider_subscriptions WHERE provider_id = $1', [providerId])
    // Resetear a comisión estándar (5% por ejemplo)
    await db.query(
      'UPDATE users SET commission_rate = 5, commission_mode = \'percentage\', is_active = true WHERE id = $1',
      [providerId]
    )
    logger.info(`🗑️ [SUSCRIPCIÓN] Modo empresarial eliminado para ${providerId}. Reset a básico.`)
  }

  // 🤖 WORKER NOCTURNO: Verificar y suspender cuentas vencidas automáticamente
  async runExpirationWorker() {
    logger.info('🔄 [SUBS WORKER] Verificando suscripciones vencidas...')
    try {
      // Buscar suscripciones vencidas con 3 días de gracia
      const { rows: expired } = await db.query(`
        SELECT ps.provider_id, u.name, u.email
        FROM provider_subscriptions ps
        JOIN users u ON ps.provider_id = u.id
        WHERE ps.status IN ('active', 'trial')
          AND ps.expires_at < NOW() - INTERVAL '3 days'
      `)

      for (const sub of expired) {
        await this.suspendSubscription(sub.provider_id)
        logger.info(`🚫 [SUBS WORKER] Cuenta suspendida: ${sub.name} (${sub.email})`)
      }

      // Buscar suscripciones que vencen en 3 días para notificar
      const { rows: expiringSoon } = await db.query(`
        SELECT ps.provider_id, u.name, u.email, ps.expires_at
        FROM provider_subscriptions ps
        JOIN users u ON ps.provider_id = u.id
        WHERE ps.status = 'active'
          AND ps.expires_at BETWEEN NOW() AND NOW() + INTERVAL '3 days'
      `)

      if (expiringSoon.length > 0) {
        logger.info(`⚠️ [SUBS WORKER] ${expiringSoon.length} suscripciones próximas a vencer`)
        for (const sub of expiringSoon) {
          // Registro industrial de advertencia
          logger.warn(`📢 [ALERTA SUBS] La suscripción de ${sub.name} vence el ${new Date(sub.expires_at).toLocaleDateString()}`)
        }
      }

      logger.info(`✅ [SUBS WORKER] Proceso completado. ${expired.length} cuentas suspendidas.`)
    } catch (error: any) {
      logger.error('❌ [SUBS WORKER] Error:', { error: error.message })
    }
  }

  // Obtener la tasa de comisión activa de un proveedor (usada en OrderService)
  async getActiveCommissionRate(providerId: string): Promise<{ rate: number; planName: string }> {
    const sub = await this.getProviderSubscription(providerId)
    
    if (!sub || sub.status === 'suspended') {
      return { rate: 5, planName: 'Sin Plan (Default)' } // Tasa default si no tiene plan
    }

    return {
      rate: parseFloat(sub.commission_rate),
      planName: sub.plan_name
    }
  }
}

export const subscriptionService = new SubscriptionService()
