/**
 * ═══════════════════════════════════════════════════════════════
 * TRACKING SERVICE — ARQUITECTURA DE PROVEEDORES INTERCAMBIABLES
 * ═══════════════════════════════════════════════════════════════
 * 
 * NIVEL 1 (HOY):    Links de rastreo directo → costo cero, siempre funciona.
 * NIVEL 2 (FUTURO): Reemplaza el método 'queryProvider()' de cada proveedor
 *                   con una llamada a su API oficial y el resto del sistema
 *                   no cambia absolutamente nada.
 * 
 * Para activar una API oficial:
 *   1. Implementa el método 'queryProvider()' del proveedor con la llamada HTTP.
 *   2. Añade el API_KEY en el .env  (ej: OLVA_API_KEY, SHALOM_API_KEY).
 *   3. Cambia hasApi = true en el proveedor correspondiente.
 */

import { logger } from '../api/utils/logger'
import { db } from '../database/db'
import { notificationService } from './notification.service'
import { logisticsAgentService } from './logisticsAgent.service'
import { MessageMedia } from 'whatsapp-web.js'

// ─────────────────────────────────────────────────────────────
// INTERFAZ DE PROVEEDOR (Contrato para futuras APIs)
// ─────────────────────────────────────────────────────────────
export interface CourierResult {
  status: string
  detail: string
  trackingUrl: string
  deliveredAt?: string
  screenshot?: string // Ruta local a la captura de pantalla
}

export interface CourierProvider {
  name: string
  hasApi: boolean
  getTrackingUrl(guideNumber: string): string
  queryProvider?(guideNumber: string): Promise<CourierResult | null>
}

// ─────────────────────────────────────────────────────────────
// PROVEEDORES REGISTRADOS
// ─────────────────────────────────────────────────────────────
const COURIERS: Record<string, CourierProvider> = {

  shalom: {
    name: 'Shalom',
    hasApi: true, // → ACTIVADO: Login Élite + Fallback Visión IA
    getTrackingUrl: (guide) =>
      `https://rastrea.shalom.pe/`,

    async queryProvider(guide) {
      try {
        const result = await logisticsAgentService.trackShalom(guide)
        return {
          status: result.status,
          detail: result.detail || `Estado detectado vía Agente Atti: ${result.status}`,
          trackingUrl: this.getTrackingUrl(guide),
          screenshot: result.screenshot
        }
      } catch (err) {
        return null
      }
    }
  },

  olva: {
    name: 'Olva Courier',
    hasApi: true, // → ACTIVADO: Stealth DOM + Fallback Visión IA
    getTrackingUrl: (guide) =>
      `https://www.olvacourier.com/seguimiento/?codigo=${encodeURIComponent(guide)}`,

    async queryProvider(guide) {
      try {
        const result = await logisticsAgentService.trackOlva(guide)
        return {
          status: result.status,
          detail: result.detail || `Verificado por Agente Atti: ${result.status}`,
          trackingUrl: this.getTrackingUrl(guide),
          screenshot: result.screenshot
        }
      } catch (err) {
        return null
      }
    }
  },

  serpost: {
    name: 'Serpost',
    hasApi: false,
    getTrackingUrl: (guide) =>
      `https://www.serpost.com.pe/tracking/buscar?tracking=${encodeURIComponent(guide)}`,
  },

  dhl: {
    name: 'DHL Express',
    hasApi: false, // → DHL tiene API oficial: developer.dhl.com
    getTrackingUrl: (guide) =>
      `https://www.dhl.com/pe-es/home/tracking.html?tracking-id=${encodeURIComponent(guide)}`,

    // FUTURO: API DHL (requiere cuenta business en developer.dhl.com)
    // async queryProvider(guide) {
    //   const res = await fetch(`https://api-eu.dhl.com/track/shipments?trackingNumber=${guide}`, {
    //     headers: { 'DHL-API-Key': process.env.DHL_API_KEY || '' }
    //   })
    //   const data = await res.json()
    //   const shipment = data.shipments?.[0]
    //   return { status: shipment?.status?.description, detail: shipment?.events?.[0]?.location?.address?.addressLocality, trackingUrl: this.getTrackingUrl(guide) }
    // }
  },

  fedex: {
    name: 'FedEx',
    hasApi: false,
    getTrackingUrl: (guide) =>
      `https://www.fedex.com/fedextrack/?trknbr=${encodeURIComponent(guide)}`,
  },

  otros: {
    name: 'Courier',
    hasApi: false,
    getTrackingUrl: (guide) => `https://www.google.com/search?q=rastrear+paquete+${encodeURIComponent(guide)}`,
  },
}

// ─────────────────────────────────────────────────────────────
// SERVICIO PRINCIPAL
// ─────────────────────────────────────────────────────────────
export class TrackingService {
  private isProcessing = false

  /**
   * Resuelve el proveedor de courier por nombre (insensible a mayúsculas).
   */
  getProvider(agency: string): CourierProvider {
    const key = (agency || '').toLowerCase().trim()
    return COURIERS[key] || COURIERS['otros']
  }

  /**
   * Genera el link de rastreo directo para mostrar al cliente.
   */
  getTrackingUrl(agency: string, guideNumber: string): string {
    return this.getProvider(agency).getTrackingUrl(guideNumber)
  }

  /**
   * Consulta el estado real del paquete.
   * Si el proveedor tiene API activa (hasApi=true), la usa.
   * Si no, devuelve un resultado genérico con el link para que el cliente rastree.
   */
  async queryStatus(agency: string, guideNumber: string): Promise<CourierResult | null> {
    const provider = this.getProvider(agency)

    // Nivel 2 futuro: usar API si está disponible
    if (provider.hasApi && provider.queryProvider) {
      try {
        return await provider.queryProvider(guideNumber)
      } catch (err: any) {
        logger.warn(`[TRACKING] API de ${provider.name} falló, usando fallback: ${err.message}`)
      }
    }

    // Nivel 1 (hoy): solo devolvemos el link para que el cliente rastree
    return {
      status: 'en_tránsito',
      detail: `Consulta el estado en tiempo real en el sitio oficial de ${provider.name}.`,
      trackingUrl: provider.getTrackingUrl(guideNumber),
    }
  }

  /**
   * Genera el mensaje de WhatsApp con guía + link de rastreo.
   * Usado por fulfillment.service cuando se registra la guía o se despacha.
   */
  buildGuideNotification(order: any): string {
    const name    = order.customer_name?.split(' ')[0] || 'Cliente'
    const ref     = order.payment_reference_code || order.id?.slice(0, 8).toUpperCase()
    const agency  = order.courier_agency || 'otros'
    const guide   = order.guide_number
    const isIntl  = order.shipping_type === 'international' || order.shipping_type === 'global'
    const url     = this.getTrackingUrl(agency, guide)
    const pName   = this.getProvider(agency).name

    if (isIntl) {
      return (
        `✈️ *¡Tu importación está en el último tramo!* 🇵🇪\n\n` +
        `Hola *${name}*, tu pedido *#${ref}* fue entregado a *${pName}* para el reparto final en Perú.\n\n` +
        `🏷️ *Número de Guía:* \`${guide}\`\n` +
        `🔍 *Si deseas verificar más detalles, búscalo en la web oficial de ${pName}:*\n${url}\n\n` +
        `_Escríbenos si necesitas ayuda. **Atti** está disponible 24/7._ 🤖`
      )
    }

    return (
      `🚀 *¡Tu pedido está en camino!* 📦\n\n` +
      `Hola *${name}*, tu paquete *#${ref}* fue entregado a *${pName}* para el despacho.\n\n` +
      `🏷️ *Número de Guía:* \`${guide}\`\n` +
      `🔍 *Si deseas verificar más detalles, búscalo en la web oficial de ${pName}:*\n${url}\n\n` +
      `_¿Tienes alguna pregunta? **Atti** te atiende por este chat._ 🤖`
    )
  }

  /**
   * Worker de rastreo automático (cada 4 horas).
   * Hoy: notifica con link. Futuro: consulta API y notifica el estado real.
   */
  async processPendingTrackings() {
    if (this.isProcessing) return
    this.isProcessing = true

    try {
      const { rows: orders } = await db.query(
        `SELECT id, user_id, customer_phone, customer_name, courier_agency,
                guide_number, last_tracking_status, tracking_notified_statuses,
                payment_reference_code, shipping_type, status
         FROM orders
         WHERE guide_number IS NOT NULL
           AND status NOT IN ('entregado', 'cancelado')
           AND (last_tracking_checked_at IS NULL OR last_tracking_checked_at < NOW() - INTERVAL '4 hours')
         LIMIT 20`
      )

      for (const order of orders) {
        const provider = this.getProvider(order.courier_agency)

        let result: CourierResult | null = null

        // Si tiene API activa, consulta el estado real
        if (provider.hasApi && provider.queryProvider) {
          result = await this.queryStatus(order.courier_agency, order.guide_number)
        }

        // Actualizar fecha de último chequeo siempre
        await db.query(
          `UPDATE orders SET last_tracking_checked_at = NOW() ${result ? ', last_tracking_status = $1' : ''} WHERE id = ${result ? '$2' : '$1'}`,
          result ? [result.status, order.id] : [order.id]
        )

        // Notificar si hubo cambio de estado (solo cuando hay API activa)
        if (result && result.status !== order.last_tracking_status) {
          const notified = order.tracking_notified_statuses || []
          if (!notified.includes(result.status)) {
            const url = provider.getTrackingUrl(order.guide_number)
            const name = order.customer_name?.split(' ')[0] || 'Cliente'
            const ref  = order.payment_reference_code || order.id.slice(0, 8).toUpperCase()

            const msg =
              `📍 *Actualización de tu Envío*\n\n` +
              `Hola *${name}*, tu paquete *#${ref}* tiene una novedad:\n\n` +
              `📦 *Estado:* ${result.status}\n` +
              `📝 *Detalle:* ${result.detail}\n` +
              `🔍 *Si deseas verificar más detalles, búscalo en la web oficial de ${provider.name}:*\n${url}\n\n` +
              `_Adjunto te envío la captura de pantalla oficial verificada por **Atines**._ 🤖`

            notificationService.enqueue(order.user_id, order.customer_phone, msg, result.screenshot)

            await db.query(
              `UPDATE orders SET tracking_notified_statuses = COALESCE(tracking_notified_statuses, '[]'::jsonb) || $1::jsonb WHERE id = $2`,
              [JSON.stringify([result.status]), order.id]
            )

            if (result.status === 'ENTREGADO') {
              await db.query(`UPDATE orders SET status = 'entregado' WHERE id = $1`, [order.id])
              const { npsService } = await import('./nps.service')
              await npsService.triggerSurvey({
                ...order,
                status: 'entregado'
              }).catch(e => logger.error('NPS trigger error from tracking worker:', e))
            }
          }
        }
      }
    } catch (error: any) {
      logger.error('[TRACKING] Error en worker:', error.message)
    } finally {
      this.isProcessing = false
    }
  }

  /**
   * Inicia el worker de rastreo.
   * Cuando las APIs estén activas, este worker notificará cambios automáticamente.
   */
  startWorker(intervalMs = 1000 * 60 * 240) { // cada 4 horas
    logger.info(`[TRACKING] Worker iniciado (intervalo: ${intervalMs / 60000} min). APIs activas: ${
      Object.entries(COURIERS).filter(([, p]) => p.hasApi).map(([k]) => k).join(', ') || 'ninguna (Nivel 1 activo)'
    }`)
    setTimeout(() => this.processPendingTrackings(), 5000)
    setInterval(() => this.processPendingTrackings(), intervalMs)
  }
}

export const trackingService = new TrackingService()
