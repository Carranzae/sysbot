import Groq from 'groq-sdk'
import { db } from '../../../database/db'
import { logger } from '../../../api/utils/logger'
import fs from 'fs'
import path from 'path'
import * as dotenv from 'dotenv'

class GroqKeyManager {
  private keys: { key: string; isRateLimited: boolean; unbanAt: number }[] = []
  private currentIndex: number = 0
  private lastReloadTime: number = 0
  private RELOAD_INTERVAL = 30000 // Solo recargar del disco cada 30 segundos para evitar lag

  constructor() {
    this.reloadKeysFromEnvFile()
  }

  // Permite recargar el .env "en caliente" sin reiniciar el servidor
  public reloadKeysFromEnvFile(force = false) {
    const now = Date.now()
    if (!force && now - this.lastReloadTime < this.RELOAD_INTERVAL) return

    try {
      const envPath = path.resolve(process.cwd(), '.env')
      if (!fs.existsSync(envPath)) return

      const envContent = fs.readFileSync(envPath, 'utf-8')
      const envConfig = dotenv.parse(envContent)
      
      let allKeysString = ''
      for (const [envKey, envValue] of Object.entries(envConfig)) {
        if (envKey.includes('GROQ_API_KEY') && envValue) {
          allKeysString += envValue + ','
        }
      }

      const rawKeys = allKeysString
        .split(',')
        .map(k => k.replace(/['"\[\]]/g, '').trim()) // Quita comillas simples/dobles y corchetes
        .filter(k => k && k.startsWith('gsk_')) // Solo incluir llaves reales de Groq

      // Preservar el estado de rate limit si la llave ya existía
      const newKeysArray = rawKeys.map(key => {
        const existing = this.keys.find(k => k.key === key)
        return existing ? existing : { key, isRateLimited: false, unbanAt: 0 }
      })

      if (this.keys.length > 0 && newKeysArray.length > this.keys.length) {
         logger.info(`✅ [API POOL] Detectadas nuevas llaves. Total en rotación: ${newKeysArray.length}`)
      }
      
      this.keys = newKeysArray
      this.lastReloadTime = now
    } catch (e) {
      logger.error('Error recargando llaves desde .env', e as any)
    }
  }

  // Obtiene una llave 'sana' y una instancia de Groq lista para usar
  getAvailableInstance(): { groq: Groq; keyIndex: number } | null {
    // Escaneo inteligente: Solo recarga si ha pasado el intervalo
    this.reloadKeysFromEnvFile()

    if (this.keys.length === 0) return null

    const now = Date.now()
    let attempts = 0

    while (attempts < this.keys.length) {
      const keyObj = this.keys[this.currentIndex]
      
      // Liberar llaves si su tiempo de penalización ya pasó
      if (keyObj.isRateLimited && now > keyObj.unbanAt) {
        keyObj.isRateLimited = false
      }

      if (!keyObj.isRateLimited) {
        const groq = new Groq({ apiKey: keyObj.key })
        const usedIndex = this.currentIndex
        // Mover el índice para repartir la carga (Round Robin)
        this.currentIndex = (this.currentIndex + 1) % this.keys.length
        return { groq, keyIndex: usedIndex }
      }

      this.currentIndex = (this.currentIndex + 1) % this.keys.length
      attempts++
    }

    return null // Todas las llaves están bloqueadas
  }

  public getKeysCount(): number {
    return this.keys.length
  }

  // Si una llave falla por 429, la baneamos temporalmente
  reportRateLimit(index: number, retryAfterMinutes = 1, reason = 'Rate Limit') {
    if (this.keys[index]) {
      this.keys[index].isRateLimited = true
      this.keys[index].unbanAt = Date.now() + retryAfterMinutes * 60 * 1000
      logger.warn(`🔄 [API POOL] Llave #${index} bloqueada por ${reason}. En cuarentena por ${retryAfterMinutes} minutos.`)
    }
  }
}

export const keyManager = new GroqKeyManager()

export class AIService {
  async chat(message: string, history: any[] = [], providerId?: string, customerPhone?: string, isManagementMode = false) {
    try {
      const instanceData = keyManager.getAvailableInstance()
      if (!instanceData) {
        logger.error('❌ Todas las API Keys están bloqueadas por Rate Limit.')
        return { text: 'Lo siento, nuestros servidores están muy ocupados ahora. Por favor, intenta de nuevo en unos minutos.' }
      }
      const { groq, keyIndex } = instanceData
      
      let context = ''
      if (providerId) {
          if (isManagementMode) {
              // CONTEXTO DE ÉLITE PARA EL ADMINISTRADOR
              const stats = await this.getAdminStats()
              const lowStock = await this.getLowStockItems()
              const { rows: recentOrders } = await db.query(
                  `SELECT id, customer_name, total, status, created_at 
                   FROM orders WHERE user_id = $1 ORDER BY created_at DESC LIMIT 5`,
                  [providerId]
              )

              context = `[MODO ADMINISTRADOR ACTIVADO]
📊 MÉTRICAS DEL NEGOCIO:
- Ventas Totales: S/ ${stats.revenue}
- Pedidos Pendientes de Despacho: ${stats.pending}
- Productos con Stock Bajo (<5): ${stats.lowStock}

📦 ÚLTIMOS 5 PEDIDOS:
${recentOrders.map(o => `• ${o.customer_name} - S/ ${o.total} [${o.status}]`).join('\n')}

⚠️ ALERTAS DE INVENTARIO:
${lowStock.map(i => `• ${i.name}: Quedan ${i.stock}`).join('\n')}`
          } else {
              // CONTEXTO NORMAL PARA CLIENTES
              const products = await this.searchProductsByProvider(providerId)
              if (products.length > 0) {
                  context += `\nPRODUCTOS DISPONIBLES:\n${products.map((p: any) => `- ${p.name}: S/ ${p.price}`).join('\n')}`
              }
              
              if (customerPhone) {
                  const orders = await this.getOrdersByPhone(providerId, customerPhone)
                  if (orders.length > 0) {
                      context += `\nESTADO DE LOS PEDIDOS DEL CLIENTE:\n${orders.map(o => `- Pedido #${o.payment_reference_code || o.id.slice(0,8)}: Estado actual: ${o.status}. Tracking: ${o.tracking_number || 'Pendiente'}`).join('\n')}`
                  }
              }
          }
      }

      const systemPrompt = isManagementMode 
        ? `Eres Atines Copilot, el asistente administrativo de ÉLITE. 
           Tu misión es dar respuestas precisas y analíticas al DUEÑO del negocio.
           Usa el CONTEXTO DE ÉLITE para responder cualquier duda sobre ventas, stock o pedidos.
           Sé profesional, directo y ejecutivo.`
        : `Eres el Asistente Virtual exclusivo de este negocio en WhatsApp.
           Tu misión es brindar soporte, vender y responder preguntas sobre pedidos.
           CONTEXTO: ${context}`

      let responseContent = ''
      let success = false
      let attempts = 0
      const maxAttempts = keyManager.getKeysCount() // Probar todas las llaves si es necesario

      while (!success && attempts < maxAttempts) {
        const instanceData = keyManager.getAvailableInstance()
        if (!instanceData) break
        
        const { groq, keyIndex } = instanceData
        attempts++

        try {
          const completion = await groq.chat.completions.create({
            messages: [
              { role: 'system', content: systemPrompt },
              ...history.slice(-4),
              { role: 'user', content: message }
            ],
            model: 'llama-3.1-8b-instant',
            max_tokens: 400,
          }, { timeout: 8000 })
          responseContent = completion.choices[0]?.message?.content || ''
          success = true
        } catch (err: any) {
          const isTimeoutOrConnection = err?.name === 'APITimeoutError' || err?.name === 'APIConnectionError' || err?.code === 'ETIMEDOUT'
          const isServerError = err?.status >= 500 && err?.status < 600
          if (err?.status === 429 || err?.status === 401 || isTimeoutOrConnection || isServerError) {
            const isAuthError = err?.status === 401
            const banTime = isAuthError ? 999999 : 1
            const reason = isAuthError ? 'Token Inválido (401)' : (isTimeoutOrConnection ? 'Timeout/Conexión' : isServerError ? `Error servidor (${err.status})` : 'Rate Limit (429)')
            keyManager.reportRateLimit(keyIndex, banTime, reason)
            logger.warn(`⚠️ Llave #${keyIndex} falló (${reason}). Reintentando con la siguiente...`)
            continue
          }
          logger.warn(`⚠️ [AI-CHAT] Error inesperado en llave #${keyIndex}: ${err?.message}. Intentando siguiente llave...`)
          continue
        }
      }

      if (!success) {
        return { text: 'Lo siento, nuestros servidores están muy ocupados. Intenta de nuevo en un minuto.' }
      }

      return { text: responseContent }
    } catch (e: any) {
      logger.error('Error en AI Chat:', { error: e?.message, status: e?.status, name: e?.name })
      return { text: 'Lo siento, hubo un error procesando tu solicitud. Por favor, intenta de nuevo más tarde.' }
    }
  }

  async chatStream(message: string, history: any[] = [], userId?: string, isManagementMode = false, cartItems: any[] = [], catalogContext: string = 'nacional', requestProducts = false) {
    try {
      // La verificación de llaves ahora la maneja el KeyManager
      // 1. OBTENER CONTEXTO (RAG)
      let context = ''
      
      if (isManagementMode) {
        // CONTEXTO PARA ADMINISTRADORES (Métricas de Negocio)
        const stats = await this.getAdminStats()
        context += `\nESTADO DEL NEGOCIO (ADMIN):\n- Ventas Totales: S/ ${stats.revenue}\n- Pedidos Pendientes: ${stats.pending}\n- Productos con Stock Bajo: ${stats.lowStock}`
        
        if (/stock|inventario|falta/i.test(message)) {
            const lowStockItems = await this.getLowStockItems()
            context += `\nPRODUCTOS CON STOCK BAJO:\n${lowStockItems.map(i => `- ${i.name}: ${i.stock} unidades`).join('\n')}`
        }
      } else {
        // CONTEXTO PARA CLIENTES (Productos y Pedidos propios)
        if (cartItems && cartItems.length > 0) {
            context += `\nCARRITO ACTUAL DEL CLIENTE:\n${cartItems.map(i => `- ${i.name} (Cantidad: ${i.quantity})`).join('\n')}`
        }

        const looksLikeProductSearch = requestProducts || /producto|vendes|tienes|precio|oferta|comprar|buscar|quiero|nike|adidas|iphone|zapatilla|reloj|marca|modelo/i.test(message)
        if (looksLikeProductSearch) {
            const products = await this.searchProductsForAI(message, catalogContext)
            if (products.length > 0) {
            context += `\nCATÁLOGO ENCONTRADO (Resultados exactos):\n${products.map(p => `- Marca/Categoría: ${p.category || 'N/A'} | Modelo: ${p.name} | Precio: S/ ${p.price} | Stock: ${p.stock} | ID: ${p.id}`).join('\n')}`
            }
        }

        if (userId && /pedido|estado|donde esta|envio|rastrear|problema/i.test(message)) {
            const orders = await this.getUserOrders(userId)
            if (orders.length > 0) {
            context += `\nÚLTIMOS PEDIDOS DEL USUARIO:\n${orders.map(o => `- Pedido #${o.id.slice(0,8)}: Estado ${o.status}, Pago ${o.payment_status}, Total S/ ${o.total}`).join('\n')}`
            }
        }
      }

      const systemPrompt = isManagementMode 
        ? `Eres Atines Copilot, el asistente administrativo de élite. 
           Tu misión es ayudar al administrador a gestionar su negocio con datos precisos.
           
           CONTEXTO DE GESTIÓN:
           ${context}
           
           REGLAS:
           1. Sé directo y analítico.
           2. Sugiere acciones (ej: "Deberías reponer el stock de X").
           3. Rutas Admin: /admin/orders, /admin/products, /admin/inventory.
           Comando: [NAVIGATE:ruta]`
        : `Eres atti, la Concierge Virtual de Atines. 
            Tu misión es guiar al cliente a la compra de forma RÁPIDA y DIRECTA.

            REGLAS CRÍTICAS DE COMANDOS DE ACCIÓN (Úsalos textualmente):
            1. BREVEDAD EXTREMA: Responde en MÁXIMO 1 o 2 frases. Sé directo.
            2. PRODUCTOS (FILTER_CATALOG / RECOMMEND): Si el cliente busca algo, usa [FILTER_CATALOG:marca o modelo] para buscar exacto y mostrar la tarjeta. Menciona el stock exacto que leíste del contexto (ej: "¡Me queda solo 1 par!" si el stock es 1). Si recomiendas algo, usa [RECOMMEND:producto].
            3. NAVEGACIÓN (NAVIGATE): 
               - Si pide IMPORTACIONES o productos de USA/China: [NAVIGATE:/global]
               - Si quiere ver su PERFIL o PEDIDOS: [NAVIGATE:/profile]
               - Si quiere PAGAR o ver CARRITO: [NAVIGATE:/cart]
            4. SOPORTE (SUPPORT): Si detectas una queja, problema con su pedido o pide ayuda humana, usa [ACTION: SUPPORT] y dile que le abriremos un chat de WhatsApp para resolverlo de inmediato.

            CONTEXTO LOGÍSTICO:
            Catálogo actual: ${catalogContext.toUpperCase()}.
            ${catalogContext === 'global' ? 'Importación USA/China (10-20 días). Todo incluido.' : 'Stock Local (Envío Express Shalom/Olva).'}

            INVENTARIO DISPONIBLE (Stock exacto y Marcas):
            ${context || 'Consulta el catálogo general.'}

            EJEMPLO: 
            User: "Quiero importar zapatillas" 
            Tú: "¡Genial! Vamos al panel de Importaciones Globales para que veas los modelos. [NAVIGATE:/global]"
            User: "¿Tienes Nike?"
            Tú: "Sí, tenemos Nike. ¡Me queda solo 1 par del modelo Air Max! [FILTER_CATALOG:Nike Air Max]"
            User: "Tengo un problema con mi pedido"
            Tú: "Lamento el inconveniente. Te estoy comunicando con soporte ahora mismo. [ACTION: SUPPORT]"
            `

      let attempts = 0
      const maxAttempts = keyManager.getKeysCount()

      while (attempts < maxAttempts) {
        const instanceData = keyManager.getAvailableInstance()
        if (!instanceData) break
        
        const { groq, keyIndex } = instanceData
        attempts++

        try {
          return await groq.chat.completions.create({
            messages: [
              { role: 'system', content: systemPrompt },
              ...history.slice(-4),
              { role: 'user', content: message }
            ],
            model: 'llama-3.1-8b-instant',
            temperature: 0.3,
            max_tokens: 600,
            stream: true,
          }, { timeout: 10000 })
        } catch (err: any) {
          const isTimeoutOrConnection = err?.name === 'APITimeoutError' || err?.name === 'APIConnectionError' || err?.code === 'ETIMEDOUT'
          const isServerError = err?.status >= 500 && err?.status < 600
          if (err?.status === 429 || err?.status === 401 || isTimeoutOrConnection || isServerError) {
            const isAuthError = err?.status === 401
            const banTime = isAuthError ? 999999 : 1
            const reason = isAuthError ? 'Token Inválido (401)' : (isTimeoutOrConnection ? 'Timeout' : isServerError ? `Error servidor (${err.status})` : 'Rate Limit (429)')
            keyManager.reportRateLimit(keyIndex, banTime, reason)
            logger.warn(`⚠️ [STREAM] Llave #${keyIndex} falló (${reason}). Reintentando...`)
            continue
          }
          throw err
        }
      }

      throw new Error('Todas las llaves de IA están bloqueadas o son inválidas.')
    } catch (error: any) {
      logger.error('Error AI Instructor Mode:', error)
      throw error
    }
  }

  async searchProductsForAI(query: string, catalogContext: string = 'national') {
    try {
      // Búsqueda exacta (Marca + Modelo + Atributo): divide en palabras y busca todas
      const words = query.split(/\s+/).filter(w => w.length > 2)
      const searchParam = `%${query}%`
      const type = catalogContext === 'global' ? 'global' : 'national'

      if (words.length > 1) {
        // Construir condiciones dinámicas para multi-palabra
        const conditions = words.map((_, i) => `(name ILIKE $${i+1} OR description ILIKE $${i+1} OR category ILIKE $${i+1})`).join(' AND ')
        const params = words.map(w => `%${w}%`)
        params.push(type) // El último parámetro es catalog_type
        const sql = `SELECT id, name, price, description, stock, category FROM products WHERE stock > 0 AND catalog_type = $${params.length} AND (${conditions}) ORDER BY stock DESC LIMIT 5`
        const { rows } = await db.query(sql, params)
        if (rows.length > 0) return rows
      }

      // Fallback: búsqueda simple por query completa
      const { rows: fallbackRows } = await db.query(
        `SELECT id, name, price, description, stock, category FROM products 
         WHERE (name ILIKE $1 OR description ILIKE $1 OR category ILIKE $1) AND stock > 0 AND catalog_type = $2
         ORDER BY (name ILIKE $1) DESC, stock DESC LIMIT 5`,
        [searchParam, type]
      )
      return fallbackRows
    } catch (error) { return [] }
  }

  async searchProductsByProvider(providerId: string) {
    try {
      const { rows } = await db.query(
        `SELECT id, name, price, description FROM products 
         WHERE user_id = $1 AND stock > 0
         ORDER BY created_at DESC LIMIT 10`,
        [providerId]
      )
      return rows
    } catch (error) { return [] }
  }

  async getOrdersByPhone(providerId: string, phone: string) {
    try {
      // Buscar el teléfono exacto o que termine en los últimos 9 dígitos
      const phoneSuffix = phone.length > 9 ? phone.slice(-9) : phone
      const { rows } = await db.query(
        `SELECT id, status, tracking_number, shipping_address, payment_reference_code, total 
         FROM orders 
         WHERE user_id = $1 AND customer_phone LIKE $2
         ORDER BY created_at DESC LIMIT 3`,
        [providerId, `%${phoneSuffix}%`]
      )
      return rows
    } catch (error) { return [] }
  }

  private async getAdminStats() {
    try {
      const { rows: revenueRows } = await db.query('SELECT SUM(total) as revenue FROM orders')
      const { rows: pendingRows } = await db.query("SELECT COUNT(*) as pending FROM orders WHERE status = 'preparando'")
      const { rows: lowStockRows } = await db.query('SELECT COUNT(*) as low_stock FROM products WHERE stock < 5')
      
      return {
        revenue: Number(revenueRows[0].revenue || 0).toFixed(2),
        pending: pendingRows[0].pending || 0,
        lowStock: lowStockRows[0].low_stock || 0
      }
    } catch (e) {
      return { revenue: '0', pending: 0, lowStock: 0 }
    }
  }

  private async getLowStockItems() {
    try {
      const { rows } = await db.query('SELECT name, stock FROM products WHERE stock < 5 ORDER BY stock ASC LIMIT 10')
      return rows
    } catch (e) { return [] }
  }

  private async getUserOrders(userId: string) {
    try {
      const { rows } = await db.query(
        `SELECT id, status, payment_status, total, created_at 
         FROM orders WHERE customer_user_id = $1 OR user_id = $1
         ORDER BY created_at DESC LIMIT 3`,
        [userId]
      )
      return rows
    } catch (error) { return [] }
  }
}

export const aiService = new AIService()
