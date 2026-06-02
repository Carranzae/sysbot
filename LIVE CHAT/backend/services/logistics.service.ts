import axios from 'axios'
import { db } from '../database/db'
import { logger } from '../api/utils/logger'
import { encryption } from '../api/utils/encryption'
import { whatsappService } from './whatsapp.service'

/**
 * ATINES — Servicio Maestro de Logística Industrial
 * Conecta con agencias externas para rastreo automático.
 */
export class LogisticsService {
  constructor() {
    // Constructor limpio
  }

  /**
   * INICIALIZACIÓN INDUSTRIAL: Se llama explícitamente al arrancar el servidor
   */
  async initDB(retries = 3) {
    for (let i = 0; i < retries; i++) {
      try {
        await db.query('SELECT 1')

        await db.query(`
          CREATE TABLE IF NOT EXISTS logistics_agencies (
              id TEXT PRIMARY KEY,
              name TEXT NOT NULL,
              description TEXT,
              required_fields JSONB NOT NULL DEFAULT '[]',
              tracking_url_template TEXT,
              is_active BOOLEAN DEFAULT true,
              created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
          )
        `)

        // Asegurar columna tracking_history en orders
        await db.query(`
          ALTER TABLE orders ADD COLUMN IF NOT EXISTS tracking_history JSONB DEFAULT '[]';
          ALTER TABLE orders ADD COLUMN IF NOT EXISTS fulfillment_notes TEXT;
          ALTER TABLE orders ADD COLUMN IF NOT EXISTS fulfillment_updated_at TIMESTAMP WITH TIME ZONE;
        `)

        // Semilla inicial
        await db.query(`
          INSERT INTO logistics_agencies (id, name, description, required_fields, tracking_url_template)
          VALUES 
          ('olva', 'Olva Courier', 'Agencia líder en Perú', '["user", "pass", "client_id", "client_secret"]', 'https://www.olvacourier.com/rastreo?codigo={{code}}'),
          ('shalom', 'Shalom', 'Envíos a todo el Perú', '["api_key", "user_id"]', 'https://www.shalom.com.pe/rastreo?codigo={{code}}'),
          ('dhl', 'DHL Express', 'Envíos internacionales premium', '["api_key", "account_number"]', 'https://www.dhl.com/en/express/tracking.html?AWB={{code}}')
          ON CONFLICT (id) DO NOTHING
        `)

        logger.info('📦 [Logistics] Servicio de Logística listo.')
        return
      } catch (error: any) {
        if (i === retries - 1) {
          logger.error('[Logistics] Error crítico inicializando DB:', error.message)
        } else {
          logger.warn(`[Logistics] Reintentando conexión DB (${i + 1}/${retries})...`)
          await new Promise(r => setTimeout(r, 2000))
        }
      }
    }
  }

  async listAgencies() {
    const { rows } = await db.query('SELECT * FROM logistics_agencies WHERE is_active = true ORDER BY name ASC')
    return rows
  }

  async createAgency(data: any) {
    const { id, name, description, required_fields, tracking_url_template } = data
    const { rows } = await db.query(
      `INSERT INTO logistics_agencies (id, name, description, required_fields, tracking_url_template)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [id.toLowerCase(), name, description || null, JSON.stringify(required_fields || []), tracking_url_template || null]
    )
    return rows[0]
  }

  async updateAgency(id: string, data: any) {
    const fields = Object.keys(data).filter(k => ['name', 'description', 'required_fields', 'tracking_url_template', 'is_active'].includes(k))
    if (fields.length === 0) return null

    const clauses = fields.map((f, i) => {
      if (f === 'required_fields') return `${f} = $${i + 2}::jsonb`
      return `${f} = $${i + 2}`
    })
    const values = fields.map(f => f === 'required_fields' ? JSON.stringify(data[f]) : data[f])

    const { rows } = await db.query(
      `UPDATE logistics_agencies SET ${clauses.join(', ')} WHERE id = $1 RETURNING *`,
      [id, ...values]
    )
    return rows[0]
  }

  async deleteAgency(id: string) {
    const { rowCount } = await db.query('DELETE FROM logistics_agencies WHERE id = $1', [id])
    return rowCount ? rowCount > 0 : false
  }
  
  /**
   * Obtiene las credenciales necesarias para una agencia específica.
   * Prioriza: Proveedor (DB) > Global (.env)
   */
  async getAgencyCredentials(userId: string, agency: string) {
    const { rows } = await db.query('SELECT agency_credentials FROM users WHERE id = $1', [userId])
    const providerCreds = rows[0]?.agency_credentials?.[agency]

    if (providerCreds) {
      // Desencriptar campos sensibles si existen
      return this.decryptCreds(providerCreds)
    }

    // Fallback a globales del .env
    return {
      user: process.env[`${agency.toUpperCase()}_USER`],
      pass: process.env[`${agency.toUpperCase()}_PASS`],
      apiKey: process.env[`${agency.toUpperCase()}_API_KEY`],
      clientId: process.env[`${agency.toUpperCase()}_CLIENT_ID`],
      clientSecret: process.env[`${agency.toUpperCase()}_CLIENT_SECRET`]
    }
  }

  private decryptCreds(creds: any) {
    if (!creds) return {}
    const decrypted = { ...creds }
    for (const key in decrypted) {
      if (typeof decrypted[key] === 'string' && decrypted[key].includes(':')) {
        try {
          decrypted[key] = encryption.decrypt(decrypted[key])
        } catch (e: any) {
          logger.warn(`[Logistics] No se pudo desencriptar campo ${key}: ${e.message}`)
          // Si falla, mantenemos el valor original por si no estaba encriptado
        }
      }
    }
    return decrypted
  }

  /**
   * Monitor de Agencias: Sincroniza todos los pedidos en tránsito
   */
  async monitorAgencies() {
    try {
      logger.info('[Logistics] Iniciando monitoreo global de agencias...')
      // Buscar pedidos que tengan guía pero no estén entregados/cancelados
      const { rows: pendingOrders } = await db.query(`
        SELECT id FROM orders 
        WHERE guide_number IS NOT NULL 
        AND guide_number != ''
        AND status NOT IN ('entregado', 'cancelado')
        LIMIT 50
      `)

      logger.info(`[Logistics] Sincronizando ${pendingOrders.length} pedidos en tránsito...`)
      
      for (const order of pendingOrders) {
        await this.syncOrderTracking(order.id)
      }
      
      logger.info('[Logistics] Monitoreo finalizado con éxito.')
    } catch (error) {
      logger.error('[Logistics] Error en monitorAgencies:', error as any)
    }
  }

  /**
   * Consulta el estado en Olva Courier
   */
  async trackOlva(trackingNumber: string, creds: any) {
    try {
      // Simulación de llamada a API de Olva (esto se reemplaza con la URL real de Olva)
      // En un entorno industrial, aquí usaríamos axios.post con las credenciales
      logger.info(`[Logistics] Consultando Olva: ${trackingNumber}`)
      
      // Ejemplo de respuesta normalizada
      return {
        status: 'en_transito',
        location: 'Centro de Distribución Lima',
        description: 'El paquete ha salido hacia destino',
        updatedAt: new Date().toISOString()
      }
    } catch (error: any) {
      logger.error('[Logistics] Error rastreando en Olva:', error.message)
      return null
    }
  }

  /**
   * Scraper avanzado para Olva Courier (Simulación de Sesión)
   */
  private async scrapeOlva(guideNumber: string, creds: any) {
    try {
      // Meticulosidad: Validar qué credenciales tenemos (Proveedor vs Global)
      const { user, pass, clientId, clientSecret } = creds
      const accountType = clientId ? 'CORPORATIVA (Propia)' : 'ESTÁNDAR (Atines Global)'
      
      logger.info(`[Logistics] Scraping Olva Detallado - Guía: ${guideNumber} - Cuenta: ${accountType}`)

      // Lógica de simulación adaptada a la cuenta
      // En producción, aquí axios.post usaría las credenciales específicas del proveedor
      return {
        status: `En tránsito - ${accountType}`,
        history: [
          { date: new Date().toISOString(), location: 'Planta de Procesamiento', event: `Procesado con cuenta ${accountType}` },
          { date: new Date(Date.now() - 3600000).toISOString(), location: 'Centro Lima', event: 'Recibido en almacén' }
        ]
      }
    } catch (e) {
      logger.error('[Logistics] Error en scraping meticuloso de Olva:', e as any)
      return null
    }
  }

  /**
   * Scraper avanzado para Shalom (Login Élite + Fallback Visión IA)
   * Delega al LogisticsAgentService que maneja la lógica de login y fallback.
   */
  private async scrapeShalom(guideNumber: string, creds: any) {
    try {
      logger.info(`[Logistics] Iniciando rastreo Élite Shalom - Guía: ${guideNumber}`)

      // Importar dinámicamente para evitar dependencias circulares
      const { logisticsAgentService } = await import('./logisticsAgent.service')
      const result = await logisticsAgentService.trackShalom(guideNumber)

      return {
        status: result.status,
        history: [
          { date: new Date().toISOString(), location: result.detail, event: result.status }
        ]
      }
    } catch (e) {
      logger.error('[Logistics] Error en rastreo Élite de Shalom:', e as any)
      return null
    }
  }

  /**
   * Motor de Sincronización: Consulta la agencia y actualiza Atines
   */
  async syncOrderTracking(orderId: string) {
    try {
      const { rows } = await db.query('SELECT * FROM orders WHERE id = $1', [orderId])
      const order = rows[0]

      if (!order || !order.guide_number || !order.courier_agency) return

      const agency = order.courier_agency.toLowerCase()
      const creds = await this.getAgencyCredentials(order.user_id, agency)
      
      let trackingInfo = null

      if (agency === 'olva') {
        trackingInfo = await this.scrapeOlva(order.guide_number, creds)
      } else if (agency === 'shalom') {
        trackingInfo = await this.scrapeShalom(order.guide_number, creds)
      }

      if (trackingInfo) {
        // ¿Ha cambiado el estado?
        const hasChanged = order.fulfillment_notes !== trackingInfo.status
        
        await db.query(
          `UPDATE orders SET 
           fulfillment_notes = $2, 
           tracking_history = $3,
           fulfillment_updated_at = NOW() 
           WHERE id = $1`,
          [orderId, trackingInfo.status, JSON.stringify(trackingInfo.history || [])]
        )

        // Si cambió, notificar por WhatsApp automáticamente
        if (hasChanged && order.customer_phone) {
          logger.info(`[Logistics] Estado de orden ${orderId} cambió. Notificando WhatsApp...`)
          
          const config = await whatsappService.getResolvedConfig(order.user_id)
          if (config) {
            await whatsappService.sendTrackingUpdate(config, order.customer_phone, {
              orderId: order.id,
              status: trackingInfo.status,
              agency: order.courier_agency,
              guideNumber: order.guide_number
            })
          }
        }

        return { success: true, tracking: trackingInfo, notified: hasChanged }
      }
    } catch (error: any) {
      logger.error('[Logistics] Error en sincronización:', error.message)
    }
  }
}

export const logisticsService = new LogisticsService()
