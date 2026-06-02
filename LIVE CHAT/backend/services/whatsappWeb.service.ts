import pkg from 'whatsapp-web.js'
const { Client, LocalAuth, MessageMedia } = pkg
import qrcode from 'qrcode'
import { logger } from '../api/utils/logger'
import { io } from '../api/server'
import path from 'path'
import fs from 'fs'
import { conversationStateService } from './conversationState.service'
import { db } from '../database/db'
import { aiOrchestrator } from './aiOrchestrator.service'

// --- MOTOR DE PROTECCIÓN PARA WINDOWS (ANTI-CRASH EBUSY) ---
// Monkey-patch LocalAuth.prototype.logout para interceptar fallos de borrado de sesión (archivos bloqueados por Chrome como CrashpadMetrics-active.pma)
if (LocalAuth && LocalAuth.prototype && typeof LocalAuth.prototype.logout === 'function') {
  const originalLogout = LocalAuth.prototype.logout;
  LocalAuth.prototype.logout = async function (...args: any[]) {
    try {
      return await originalLogout.apply(this, args as any);
    } catch (e: any) {
      logger.warn(`[LocalAuth Failsafe] Error de logout interceptado (bloqueo de archivos en Windows): ${e.message}`);
      // No relanzamos el error para evitar que la aplicación se caiga por un fallo menor de limpieza
    }
  };
}


// Detectar Chrome/Chromium instalado en Windows o Linux
function findChromePath(): string | undefined {
  const candidates = [
    // Windows - Chrome
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    // Windows - Edge (Chromium-based, funciona perfecto)
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    // Linux
    '/usr/bin/google-chrome-stable',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium-browser',
    '/usr/bin/chromium',
  ]
  for (const p of candidates) {
    if (fs.existsSync(p)) {
      logger.info(`Chrome encontrado en: ${p}`)
      return p
    }
  }
  logger.warn('No se encontró Chrome/Edge instalado. whatsapp-web.js puede fallar.')
  return undefined
}

interface WhatsAppSession {
  client: InstanceType<typeof Client>
  qr?: string
  code?: string       // código de vinculación telefónica
  status: 'disconnected' | 'qr' | 'loading' | 'connected'
  ownPhone?: string   // número real del proveedor
  ownLid?: string     // LID interno de WhatsApp (puede diferir del número real)
}

class WhatsAppWebManager {
  private sessions: Map<string, WhatsAppSession> = new Map()
  private pendingInitializations: Map<string, Promise<WhatsAppSession>> = new Map()
  private botEnabled: Map<string, boolean> = new Map()
  private processingMessages: Set<string> = new Set()
  private botSentMessagesCache: Set<string> = new Set()
  private normalizeForCache(text: string): string {
    return (text || '').toLowerCase().replace(/\r\n/g, '\n').replace(/\s+/g, ' ').trim()
  }

  private cacheSentMessage(msgOrText: any): void {
    if (!msgOrText) return
    if (typeof msgOrText === 'string') {
      const normalized = this.normalizeForCache(msgOrText)
      this.botSentMessagesCache.add(normalized)
      setTimeout(() => this.botSentMessagesCache.delete(normalized), 30000)
    } else {
      if (msgOrText.id && msgOrText.id._serialized) {
        const id = msgOrText.id._serialized
        this.botSentMessagesCache.add(id)
        setTimeout(() => this.botSentMessagesCache.delete(id), 30000)
      }
      if (msgOrText.body) {
        const normalized = this.normalizeForCache(msgOrText.body)
        this.botSentMessagesCache.add(normalized)
        setTimeout(() => this.botSentMessagesCache.delete(normalized), 30000)
      }
    }
  }

  private settingsFile = path.join(process.cwd(), '.wwebjs_auth', 'bot_settings.json')

  private loadSettings(): void {
    try {
      if (fs.existsSync(this.settingsFile)) {
        const raw = fs.readFileSync(this.settingsFile, 'utf-8')
        const data = JSON.parse(raw)
        for (const [userId, enabled] of Object.entries(data)) {
          this.botEnabled.set(userId, Boolean(enabled))
        }
        logger.info(`✅ Configuración del bot cargada para ${Object.keys(data).length} proveedor(es)`)
      }
    } catch (e) {
      logger.warn('No se pudo cargar bot_settings.json. Usando defaults.')
    }
  }

  private saveSettings(): void {
    try {
      const data: Record<string, boolean> = {}
      for (const [userId, enabled] of this.botEnabled.entries()) {
        data[userId] = enabled
      }
      fs.writeFileSync(this.settingsFile, JSON.stringify(data, null, 2), 'utf-8')
    } catch (e: any) {
      logger.error('Error guardando bot_settings.json', { error: (e as any)?.message })
    }
  }

  getBotEnabled(userId: string): boolean {
    return this.botEnabled.get(userId) ?? true // activo por defecto
  }

  setBotEnabled(userId: string, enabled: boolean): void {
    this.botEnabled.set(userId, enabled)
    this.saveSettings() // persistir inmediatamente
    logger.info(`Bot de WhatsApp ${enabled ? 'ACTIVADO ✅' : 'DETENIDO ⛔'} para ${userId}`)
    io.to(`user_${userId}`).emit('whatsapp_bot_toggle', { enabled })
  }

  constructor() {
    // Asegurar que el directorio de sesiones existe
    const sessionsDir = path.join(process.cwd(), '.wwebjs_auth')
    // Cargar estados persistidos
    this.loadSettings()
  }

  /**
   * Inicializa todas las sesiones activas en el arranque (Motor de Auto-Inicio)
   */
  public async initializeAllSessions(): Promise<void> {
    try {
      const { db } = await import('../database/db.js')
      // Buscar usuarios que tengan configurado WhatsApp Web
      const { rows } = await db.query("SELECT id FROM users WHERE role IN ('provider', 'admin', 'owner')")
      
      logger.info(`[AUTO-START] Escaneando sesiones guardadas para ${rows.length} usuarios...`)
      
      const fs = await import('fs')
      for (const user of rows) {
        const sessionPath = path.join(process.cwd(), '.wwebjs_auth', `session-${user.id}`)
        if (fs.existsSync(sessionPath)) {
          logger.info(`[AUTO-START] Reanudando sesión activa para: ${user.id}`)
          this.getSession(user.id).catch(err => {
            logger.error(`[AUTO-START] Error reanudando sesión ${user.id}: ${err.message}`)
          })
        }
      }
    } catch (error: any) {
      logger.error('[AUTO-START] Error en inicialización global:', error.message)
    }
  }

  /**
   * Obtiene el estado de la sesión de forma síncrona (lectura rápida de caché)
   */
  public getSessionSync(userId: string): WhatsAppSession | undefined {
    return this.sessions.get(userId)
  }

  /**
   * Obtiene estadísticas de todas las sesiones activas de WhatsApp Web
   */
  public getAllSessionsStats() {
    const list: any[] = []
    for (const [userId, session] of this.sessions.entries()) {
      list.push({
        userId,
        status: session.status,
        ownPhone: session.ownPhone || null
      })
    }
    return list
  }

  /**
   * Obtiene o inicializa la sesión de un usuario de forma segura (concurrencia controlada)
   */
  async getSession(userId: string, usePairingCode?: boolean, phone?: string): Promise<WhatsAppSession> {
    if (this.sessions.has(userId)) {
      return this.sessions.get(userId)!
    }

    // Si ya hay una inicialización en curso para este usuario, esperar a esa promesa
    if (this.pendingInitializations.has(userId)) {
      logger.info(`[WhatsApp] Esperando inicialización en curso para: ${userId}`)
      return this.pendingInitializations.get(userId)!
    }

    // Registrar nueva promesa de inicialización
    const initPromise = this.initSession(userId, usePairingCode, phone).finally(() => {
      this.pendingInitializations.delete(userId)
    })
    
    this.pendingInitializations.set(userId, initPromise)
    return initPromise
  }

  private async initSession(userId: string, usePairingCode?: boolean, phone?: string): Promise<WhatsAppSession> {
    logger.info(`Iniciando sesión de WhatsApp Web para usuario: ${userId}`)

    const chromePath = findChromePath()

    // Cargar número de teléfono si se requiere vinculación por código y no se especificó uno personalizado
    let finalPhone = phone
    if (usePairingCode && !finalPhone) {
      try {
        const { db } = await import('../database/db.js')
        const { rows } = await db.query("SELECT phone FROM users WHERE id = $1", [userId])
        finalPhone = rows[0]?.phone
      } catch (dbErr: any) {
        logger.error('Error obteniendo teléfono de base de datos para emparejamiento:', dbErr)
      }
    }

    const clientOptions: any = {
      authStrategy: new LocalAuth({
        clientId: userId,
        dataPath: path.resolve(process.cwd(), '.wwebjs_auth')
      }),
      puppeteer: {
        headless: true,
        executablePath: chromePath,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--disable-gpu',
          '--disable-extensions',
          '--disable-background-networking',
          '--disable-default-apps',
          '--disable-sync',
          '--disable-translate',
          '--hide-scrollbars',
          '--metrics-recording-only',
          '--mute-audio',
          '--no-default-browser-check',
          '--disable-component-update',
          '--js-flags="--max-old-space-size=256"' // Límite estricto de RAM por instancia
        ],
      }
    }

    if (usePairingCode && finalPhone) {
      let cleanPhone = finalPhone.replace(/\D/g, '')
      if (cleanPhone.length === 9) {
        cleanPhone = '51' + cleanPhone // Prefijo de Perú por defecto si tiene 9 dígitos
      }
      clientOptions.pairWithPhoneNumber = {
        phoneNumber: cleanPhone,
        showNotification: true
      }
      logger.info(`[WhatsApp-Pairing] Configurando vinculación por código para: ${cleanPhone}`)
    }

    const client = new Client(clientOptions)

    const session: WhatsAppSession = {
      client,
      status: 'loading'
    }

    this.sessions.set(userId, session)

    client.on('qr', async (qr) => {
      logger.info(`Nuevo QR generado para ${userId}`)
      const qrDataUrl = await qrcode.toDataURL(qr)
      session.qr = qrDataUrl
      session.code = undefined
      session.status = 'qr'

      // Notificar vía Socket.io si el usuario está conectado
      io.to(`user_${userId}`).emit('whatsapp_qr', { qr: qrDataUrl, code: null })
    })

    client.on('code', (code) => {
      logger.info(`[WhatsApp-Pairing] Nuevo código de vinculación generado para ${userId}: ${code}`)
      session.qr = undefined
      session.code = code
      session.status = 'qr' // Mantenemos status 'qr' para la máquina de estados pero mandando el código

      // Notificar vía Socket.io
      io.to(`user_${userId}`).emit('whatsapp_code', { code })
      io.to(`user_${userId}`).emit('whatsapp_qr', { qr: null, code })
    })

    client.on('ready', () => {
      logger.info(`WhatsApp Web listo para ${userId}`)
      session.status = 'connected'
      session.qr = undefined
      session.code = undefined

      // Guardar el número real Y el LID de la sesión conectada
      try {
        const wid = client.info?.wid
        session.ownPhone = (wid?.user || '').replace(/\D/g, '')
        // El LID puede estar en wid.lid o wid._serialized contiene el LID en algunas versiones
        const rawLid = (wid as any)?.lid || (wid as any)?._serialized?.split('@')[0] || ''
        session.ownLid = rawLid.toString().replace(/\D/g, '')
        logger.info(`[SESSION-ID] Número real: ${session.ownPhone} | LID interno: ${session.ownLid}`)
      } catch(e) {
        logger.warn('[SESSION-ID] No se pudo capturar LID de la sesión')
      }

      io.to(`user_${userId}`).emit('whatsapp_status', { status: 'connected' })
      io.to(`user_${userId}`).emit('whatsapp_ready', { status: 'connected' })

      // --- BARRIDO PROACTIVO DE LIDS Y PUSHNAMES HISTÓRICOS ---
      setTimeout(async () => {
        try {
          // A. Barrido de LIDs largos a números reales
          const { rows } = await db.query(
            "SELECT DISTINCT customer_phone FROM whatsapp_messages WHERE user_id = $1 AND LENGTH(customer_phone) > 13",
            [userId]
          )
          if (rows.length > 0) {
            logger.info(`[LID-SWEEP] Detectados ${rows.length} LIDs históricos para barrido de limpieza...`)
            for (const r of rows) {
              const lid = r.customer_phone
              if (!client.pupPage) continue;
              const rawNum = await client.pupPage.evaluate(async (lidJid) => {
                try {
                  const wid = window.require('WAWebWidFactory').createWid(lidJid);
                  const alt = window.require('WAWebApiContact').getAlternateUserWid(wid);
                  return alt ? alt.user : null;
                } catch (err) {
                  return null;
                }
              }, `${lid}@lid`)
              if (rawNum) {
                const realNum = rawNum.replace(/\D/g, '')
                if (realNum && realNum.length <= 13) {
                  logger.info(`[LID-SWEEP] Limpieza proactiva: LID ${lid} → ${realNum}`)
                  await db.query(
                    "UPDATE whatsapp_messages SET customer_phone = $1 WHERE customer_phone = $2 AND user_id = $3",
                    [realNum, lid, userId]
                  )
                  // También actualizar el pushname si estaba puesto el número largo
                  await db.query(
                    "UPDATE whatsapp_messages SET customer_pushname = $1 WHERE customer_phone = $1 AND customer_pushname = $2 AND user_id = $3",
                    [realNum, lid, userId]
                  )
                }
              }
            }
            logger.info(`[LID-SWEEP] Barrido completado con éxito. ✅`)
          }

          // B. Barrido de pushnames vacíos o con números largos
          const { rows: dirtyPushnames } = await db.query(
            `SELECT DISTINCT customer_phone FROM whatsapp_messages 
             WHERE user_id = $1 AND LENGTH(customer_phone) <= 13 
             AND (customer_pushname IS NULL OR customer_pushname LIKE '%214409%' OR customer_pushname = customer_phone)`,
            [userId]
          )
          if (dirtyPushnames.length > 0) {
            logger.info(`[PUSHNAME-SWEEP] Detectados ${dirtyPushnames.length} contactos con pushname sucio. Resolviendo...`)
            for (const r of dirtyPushnames) {
              const phone = r.customer_phone
              try {
                const contact = await client.getContactById(`${phone}@c.us`)
                const rawName = contact.name || contact.pushname
                if (rawName && rawName.trim().length > 0 && !rawName.includes('214409')) {
                  const displayName = rawName.trim()
                  logger.info(`[PUSHNAME-SWEEP] Resuelto pushname para ${phone} -> ${displayName}`)
                  await db.query(
                    "UPDATE whatsapp_messages SET customer_pushname = $1 WHERE customer_phone = $2 AND user_id = $3",
                    [displayName, phone, userId]
                  )
                } else {
                  throw new Error("No contact name or name is a dirty LID")
                }
              } catch (contactErr) {
                // Fallback silencioso: formatear el número real hermosamente
                const formattedPhone = `+${phone.slice(0, 2)} ${phone.slice(2, 5)} ${phone.slice(5, 8)} ${phone.slice(8)}`
                logger.info(`[PUSHNAME-SWEEP-FALLBACK] Aplicando formato estético para ${phone} -> ${formattedPhone}`)
                await db.query(
                  "UPDATE whatsapp_messages SET customer_pushname = $1 WHERE customer_phone = $2 AND user_id = $3",
                  [formattedPhone, phone, userId]
                )
              }
            }
            logger.info(`[PUSHNAME-SWEEP] Barrido de nombres completado. ✅`)
          }

          // Avisar al panel para refrescar la vista
          io.to(`user_${userId}`).emit('whatsapp_status', { status: 'connected', refresh: true })
        } catch (sweepErr: any) {
          logger.error(`[LID-SWEEP] Error en barrido proactivo: ${sweepErr.message || sweepErr}`)
        }
      }, 7000)
    })

    client.on('message', async (msg) => {
      // Encontrar el userId dueño de esta sesión de cliente
      let userId: string | undefined
      for (const [id, session] of this.sessions.entries()) {
        if (session.client === client) {
          userId = id
          break
        }
      }
      
      if (!userId) return

      // --- ESCUDO ANTI-DUPLICADOS DE ÉLITE (Triple Filtro) ---
      const msgId = msg.id?._serialized || `${msg.from}_${msg.timestamp}`
      const contentHash = `${msg.from}_${msg.body.substring(0, 50)}`
      
      if (this.processingMessages?.has(msgId) || this.processingMessages?.has(contentHash)) {
        return
      }
      if (!this.processingMessages) this.processingMessages = new Set()
      this.processingMessages.add(msgId)
      this.processingMessages.add(contentHash)
      
      // Limpieza automática tras 10 segundos
      setTimeout(() => {
        this.processingMessages?.delete(msgId)
        this.processingMessages?.delete(contentHash)
      }, 10000)

      // --- SEGURIDAD DE ÉLITE: Ignorar estados y mensajes de GRUPO ---
      if (msg.isStatus || msg.from.includes('@g.us')) {
        return
      }

      try {
        // ¿Es el dueño del bot el que escribe? (Para comandos administrativos)
        const isOwner = msg.from.includes(userId.replace(/\D/g, ''))

        // --- MEJORA DE ÉLITE: Captura de Número Real y Filtro de Sesión ---
        let customerPhone = (msg.from || '').split('@')[0]
        const botNumber  = session.ownPhone  || (client.info?.wid?.user || '').replace(/\D/g, '')
        // Intentar obtener LID en tiempo real si aún no fue guardado al arrancar
        const runtimeLid = ((client.info?.wid as any)?.lid || '').toString().replace(/\D/g, '')
        const botLid     = session.ownLid || runtimeLid || ''
        const rawFrom    = customerPhone.replace(/\D/g, '')
        
        // 1. SEGURIDAD: Si el mensaje es de nosotros mismos (número real O LID), ignorar
        const isOwnMessage = msg.fromMe
          || rawFrom === botNumber
          || rawFrom === botLid
          || customerPhone === 'status'
          // Seguridad extra: si el LID del remitente termina igual que el botNumber (misma cuenta, distinto formato)
          || (botNumber.length >= 9 && rawFrom.slice(-9) === botNumber.slice(-9) && rawFrom.length > 11)

        if (isOwnMessage) {
          logger.info(`[SELF-FILTER] Ignorando mensaje propio: from=${msg.from} fromMe=${msg.fromMe}`)
          return
        }

        let displayName = ''
        try {
          const contact = await msg.getContact()
          // ── PROTECCIÓN ANTI-LID ──
          // Solo actualizamos el número si el que nos da el contacto es un número real (corto),
          // para no reemplazar números de teléfono reales por IDs internos de Meta (LIDs largos).
          const extractedNumber = contact.number || (contact.id && contact.id.user)
          if (extractedNumber && extractedNumber.length <= 13) {
            customerPhone = extractedNumber
          }

          // Volver a verificar contra el número del bot tras obtener el contacto
          // Prioridad de nombre: Agenda > Pushname
          let rawName = contact.name || contact.pushname
          
          // Preservar el nombre completo Unicode intacto (letras chinas, emojis, símbolos estéticos)
          displayName = (rawName || '').trim()
          
          // Si no tiene nombre legible, usar el número de teléfono con formato estético
          if (!displayName || displayName.length < 1 || displayName === customerPhone) {
            const cleanNum = customerPhone.replace(/\D/g, '')
            if (cleanNum.length === 11 && cleanNum.startsWith('51')) {
              displayName = `+51 ${cleanNum.slice(2, 5)} ${cleanNum.slice(5, 8)} ${cleanNum.slice(8)}`
            } else if (cleanNum.length > 13) {
              // Si es un LID de Meta largo, formatear el número real de 9 dígitos de Perú
              const realNum9 = cleanNum.slice(-9)
              displayName = `+51 9${realNum9.slice(1, 3)} ${realNum9.slice(3, 6)} ${realNum9.slice(6)}`
            } else {
              displayName = `+${cleanNum}`
            }
          }
          
          if (displayName && displayName !== customerPhone && customerPhone.length > 5) {
            await db.query(
              "UPDATE whatsapp_messages SET customer_pushname = $1 WHERE customer_phone = $2 AND user_id = $3",
              [displayName, customerPhone.replace(/\D/g, ''), userId]
            )
          }
        } catch (e: any) {
          const errMsg = e instanceof Error ? e.message : e;
          if (typeof errMsg === 'string' && errMsg.includes('getAlternateUserWid')) {
            // Error interno inofensivo de whatsapp-web.js al sincronizar historial
            logger.warn(`[DEBUG] No se pudo obtener contacto entrante: ${errMsg}`);
          } else {
            logger.error('Error capturando identidad:', { error: errMsg });
          }
        }

        customerPhone = customerPhone.replace(/\D/g, '')
        
        // 2. FILTRO DE FANTASMAS: Si el número es demasiado corto o inválido, ignorar
        if (!customerPhone || customerPhone.length < 7) {
          return
        }

        // ── RESOLUCIÓN NATIVA Y HEURÍSTICA DE LID ──
        if (customerPhone.length > 13 && client.pupPage) {
          try {
            const rawNum = await client.pupPage.evaluate(async (lidJid) => {
              try {
                const wid = (window as any).require('WAWebWidFactory').createWid(lidJid);
                const alt = (window as any).require('WAWebApiContact').getAlternateUserWid(wid);
                return alt ? alt.user : null;
              } catch (err) {
                return null;
              }
            }, `${customerPhone}@lid`)
            if (rawNum) {
              const realNum = rawNum.replace(/\D/g, '')
              if (realNum && realNum.length <= 13) {
                logger.info(`[LID-NATIVE-FIX] Resuelto LID entrante ${customerPhone} -> Número Real: ${realNum}`)
                
                // Actualizar retroactivamente la base de datos para corregir la ID de Meta histórica
                await db.query(
                  "UPDATE whatsapp_messages SET customer_phone = $1 WHERE customer_phone = $2 AND user_id = $3",
                  [realNum, customerPhone, userId]
                )
                
                customerPhone = realNum
              }
            }
          } catch (altErr: any) {
            logger.warn(`[LID-NATIVE-FIX] No se pudo resolver alternativo nativo para ${customerPhone}: ${altErr.message || altErr}`)
          }
        }

        if (customerPhone.length > 13) {
          const suffix9 = customerPhone.slice(-9)
          const existing = await db.query(
            `SELECT DISTINCT customer_phone FROM whatsapp_messages
             WHERE user_id = $1 AND RIGHT(customer_phone, 9) = $2 AND LENGTH(customer_phone) <= 13
             LIMIT 1`,
            [userId, suffix9]
          )
          if (existing.rows.length > 0) {
            logger.info(`[LID-FIX] Reasignando LID ${customerPhone} → ${existing.rows[0].customer_phone}`)
            customerPhone = existing.rows[0].customer_phone
          } else {
             // Intento 2: Buscar si tenemos el nombre guardado para forzar la fusión
             const existingByName = await db.query(
               `SELECT DISTINCT customer_phone FROM whatsapp_messages
                WHERE user_id = $1 AND customer_pushname = $2 AND LENGTH(customer_phone) <= 13
                LIMIT 1`,
               [userId, displayName]
             )
             if (existingByName.rows.length > 0 && displayName && displayName.length > 3 && !displayName.startsWith('+')) {
               logger.info(`[LID-FIX-NAME] Reasignando LID por nombre ${displayName} → ${existingByName.rows[0].customer_phone}`)
               customerPhone = existingByName.rows[0].customer_phone
             }
          }
        }

        let messageBody = msg.body

        // Notificar al panel de chat en vivo
        io.to(`user_${userId}`).emit('whatsapp_message', {
          userId,
          customerPhone,
          body: messageBody,
          timestamp: Date.now(),
          type: 'incoming',
          pushname: displayName // Enviamos el nombre de la agenda
        })

        // Guardar con el nombre de la agenda actualizado
        await db.query(`
          INSERT INTO whatsapp_messages (user_id, customer_phone, message_body, direction, source, status, customer_pushname)
          VALUES ($1, $2, $3, 'incoming', 'whatsapp_web', 'received', $4)
        `, [userId, customerPhone, messageBody, displayName])

        // --- LÓGICA DE PAUSA REFINADA (SOLO EXPLÍCITA) ---
        const isPaused = await conversationStateService.isPaused(userId, customerPhone)
        if (isPaused) {
          logger.info(`[BOT] IA en silencio manual para ${customerPhone}.`)
          return
        }

        // 2. Si el toggle general está apagado, ignorar
        if (!this.getBotEnabled(userId)) {
          return
        }

        // --- CADENCIA HUMANA ---
        const sanitizedDisplayName = (displayName || 'Cliente').replace(/[^\p{L}\p{N}\s_]/gu, '').trim()
        
        try {
          const chat = await msg.getChat()
          await chat.sendStateTyping()
        } catch (e: any) {
          logger.warn(`[DEBUG] No se pudo enviar estado "escribiendo": ${e.message}`)
        }

        // Retraso para simular humano
        await new Promise(resolve => setTimeout(resolve, 2000))

        // --- EXCLUSIVO ATINES: DETECTOR DE NUEVO PEDIDO MANUAL ---
        if (messageBody.toLowerCase().includes('acabo de hacer un pedido') || messageBody.toLowerCase().includes('referencia: #')) {
          const orderIdMatch = messageBody.match(/#(PED-\d+|[a-f0-9-]{8,})/i)
          const orderRef = orderIdMatch ? orderIdMatch[0] : ''
          
          const replyText = `¡Hola! He recibido tu solicitud del pedido ${orderRef}. 📦\n\nPor favor, *adjunta aquí la captura (vaucher)* de tu Yape, Plin o Transferencia para que pueda validarlo y preparar tu despacho de inmediato. 🚀`
          const sentMsg = await msg.reply(replyText)
          this.cacheSentMessage(sentMsg)

          // Sincronizar con el panel
          await db.query(`INSERT INTO whatsapp_messages (user_id, customer_phone, message_body, direction, source, status, customer_pushname) VALUES ($1, $2, $3, 'outgoing', 'bot', 'sent', $4)`, [userId, customerPhone, replyText, sanitizedDisplayName])
          io.to(`user_${userId}`).emit('whatsapp_message', { userId, customerPhone, body: replyText, timestamp: Date.now(), type: 'outgoing', source: 'bot', pushname: sanitizedDisplayName })
          return
        }

        // 3. Manejo de AUDIO (Reproducción y Transcripción)
        if (msg.hasMedia && (msg.type === 'ptt' || msg.type === 'audio')) {
          const media = await msg.downloadMedia()
          if (media && (media.mimetype.includes('audio') || media.mimetype.includes('ogg'))) {
            logger.info(`[BOT] Recibido audio de ${msg.from}. Procesando...`)
            
            // A. Notificar al panel (Para escuchar el audio)
            const audioDataUri = `data:${media.mimetype};base64,${media.data}`
            const audioPayload = {
              userId, customerPhone, body: '[Audio de voz]', mediaUrl: audioDataUri,
              timestamp: Date.now(), type: 'incoming', source: 'whatsapp_web', mediaType: 'audio'
            }
            io.to(`user_${userId}`).emit('whatsapp_message', audioPayload)

            // B. Transcribir para la IA
            const { voiceSTTService } = await import('./voiceSTT.service')
            const transcription = await voiceSTTService.transcribe(media.data)
            if (transcription && transcription.trim().length > 0) {
              logger.info(`[BOT] Transcripción exitosa: "${transcription}"`)
              messageBody = transcription
            } else {
              // ── FALLBACK STT: El bot nunca queda mudo ────────────────
              logger.warn(`[BOT] STT sin resultado para ${msg.from}. Enviando fallback amigable.`)
              const sttFallback = `🎤 Recibí tu nota de voz, pero tuve un pequeño problema para escucharla con claridad. 😅\n\n¿Puedes escribirme tu consulta? Así te ayudo al toque. ✍️`
              const sentFallback = await msg.reply(sttFallback)
              this.cacheSentMessage(sentFallback)
              await db.query(
                `INSERT INTO whatsapp_messages (user_id, customer_phone, message_body, direction, source, status, customer_pushname)
                 VALUES ($1, $2, $3, 'outgoing', 'bot', 'sent', $4)`,
                [userId, customerPhone, sttFallback, sanitizedDisplayName]
              )
              io.to(`user_${userId}`).emit('whatsapp_message', {
                userId, customerPhone, body: sttFallback, timestamp: Date.now(),
                type: 'outgoing', source: 'bot', pushname: sanitizedDisplayName
              })
              return // Salir sin procesar más, esperamos el mensaje escrito
            }

            // C. Guardar en BD (Temporal, se borrará en 24h)
            await db.query(`
              INSERT INTO whatsapp_messages (user_id, customer_phone, message_body, direction, source, status, customer_pushname, media_url, media_type)
              VALUES ($1, $2, $3, 'incoming', 'whatsapp_web', 'received', $4, $5, $6)
            `, [userId, customerPhone, audioPayload.body, displayName, audioDataUri, 'audio'])
          }
        }

        // 4. Manejo de IMÁGENES (Comprobantes de pago O Búsqueda Visual)
        if (msg.hasMedia && msg.type === 'image' && !messageBody) {
          const media = await msg.downloadMedia()
          if (media && media.mimetype.includes('image')) {
            // A0. Emitir y guardar la imagen entrante en el panel
            const imageDataUri = `data:${media.mimetype};base64,${media.data}`
            const imagePayload = {
              userId, customerPhone, body: '[Imagen recibida]', mediaUrl: imageDataUri,
              timestamp: Date.now(), type: 'incoming', source: 'whatsapp_web', mediaType: 'image', pushname: displayName
            }
            io.to(`user_${userId}`).emit('whatsapp_message', imagePayload)
            await db.query(`
              INSERT INTO whatsapp_messages (user_id, customer_phone, message_body, direction, source, status, customer_pushname, media_url, media_type)
              VALUES ($1, $2, $3, 'incoming', 'whatsapp_web', 'received', $4, $5, 'image')
            `, [userId, customerPhone, imagePayload.body, displayName, imageDataUri])

            // A. Intentar Verificación de Pago primero
            const { paymentVerificationService } = await import('./paymentVerification.service')
            const paymentResult = await paymentVerificationService.verifyPayment(media.data, userId, customerPhone)
            
            if (paymentResult.success || (paymentResult as any).isFraud) {
              const replyText = paymentResult.message || 'Pago verificado correctamente. ✅'
              const sentMsg = await msg.reply(replyText)
              this.cacheSentMessage(sentMsg)

              // Sincronizar con el panel
              await db.query(`INSERT INTO whatsapp_messages (user_id, customer_phone, message_body, direction, source, status, customer_pushname) VALUES ($1, $2, $3, 'outgoing', 'bot', 'sent', $4)`, [userId, customerPhone, replyText, sanitizedDisplayName])
              io.to(`user_${userId}`).emit('whatsapp_message', { userId, customerPhone, body: replyText, timestamp: Date.now(), type: 'outgoing', source: 'bot', pushname: sanitizedDisplayName })
              return
            }

            // B. Búsqueda Visual (Para Clientes)
            const { visualSearchService } = await import('./visualSearch.service')
            const visualResult = await visualSearchService.searchByImage(media.data, userId)

            if (visualResult.success && visualResult.matches && !isOwner) {
              let replyText = visualResult.message + '\n\n'
              for (const p of visualResult.matches) {
                replyText += `• *${p.name}* - S/ ${p.price}\n`
                if (p.images && p.images[0]) {
                  await this.sendMedia(userId, msg.from, p.images[0], `ID: ${p.id}`)
                }
              }
              const finalVisualText = replyText + '\n¿Te gustaría que añada alguno a tu carrito?'
              const sentMsg = await msg.reply(finalVisualText)
              this.cacheSentMessage(sentMsg)

              // Sincronizar con el panel
              await db.query(`INSERT INTO whatsapp_messages (user_id, customer_phone, message_body, direction, source, status, customer_pushname) VALUES ($1, $2, $3, 'outgoing', 'bot', 'sent', $4)`, [userId, customerPhone, finalVisualText, sanitizedDisplayName])
              io.to(`user_${userId}`).emit('whatsapp_message', { userId, customerPhone, body: finalVisualText, timestamp: Date.now(), type: 'outgoing', source: 'bot', pushname: sanitizedDisplayName })
              return
            }

            // C. Inventario Express (Solo para Dueño)
            if (isOwner) {
              logger.info(`[ADMIN] Recibida imagen de dueño. Analizando como nuevo producto...`)
              const { inventoryIAService } = await import('./inventoryIA.service')
              // Usamos un placeholder para la URL ya que no tenemos storage externo, 
              // en producción esto se subiría a S3/Cloudinary
              const draft = await inventoryIAService.analyzeNewProduct(media.data, 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=500&q=80')
              
              if (draft) {
                conversationStateService.set(userId, customerPhone, { draftProduct: draft })
                const replyText = `✨ *INVENTARIO EXPRESS: NUEVO PRODUCTO DETECTADO*\n\nHe analizado la foto y sugiero esto:\n\n📦 *Nombre:* ${draft.name}\n💰 *Precio:* S/ ${draft.price}\n📝 *Descripción:* ${draft.description}\n🗂️ *Categoría:* ${draft.category}\n\n¿Deseas publicarlo en tu tienda ahora mismo?\n\nResponde *CONFIRMAR* para subirlo.`
                const sentMsg = await msg.reply(replyText)
                this.cacheSentMessage(sentMsg)
                await db.query(`INSERT INTO whatsapp_messages (user_id, customer_phone, message_body, direction, source, status, customer_pushname) VALUES ($1, $2, $3, 'outgoing', 'bot', 'sent', $4)`, [userId, customerPhone, replyText, sanitizedDisplayName])
                io.to(`user_${userId}`).emit('whatsapp_message', { userId, customerPhone, body: replyText, timestamp: Date.now(), type: 'outgoing', source: 'bot', pushname: sanitizedDisplayName })
                return
              }
            }
            
            // D. Fallback: Agradecimiento si la IA no pudo validar automáticamente
            const fallbackText = 'He recibido una imagen. 📸 Mi equipo la revisará manualmente para confirmar tu pago en los próximos minutos. ¡Gracias por tu paciencia! 📦✨'
            const sentMsg = await msg.reply(fallbackText)
            this.cacheSentMessage(sentMsg)

            await db.query(`INSERT INTO whatsapp_messages (user_id, customer_phone, message_body, direction, source, status, customer_pushname) VALUES ($1, $2, $3, 'outgoing', 'bot', 'sent', $4)`, [userId, customerPhone, fallbackText, sanitizedDisplayName])
            io.to(`user_${userId}`).emit('whatsapp_message', { userId, customerPhone, body: fallbackText, timestamp: Date.now(), type: 'outgoing', source: 'bot', pushname: sanitizedDisplayName })
            return
          }
        }

        // --- FIN DE FILTROS, PASAMOS A PROCESAMIENTO ---
        
        if (isOwner) {
          const cmd = messageBody.toLowerCase().trim()

          // A. Confirmar inventario ('CONFIRMAR' o 'LISTO')
          if (cmd === 'confirmar' || cmd === 'listo') {
            const state = await conversationStateService.get(userId, customerPhone)
            if (state && state.draftProduct) {
              const { inventoryIAService } = await import('./inventoryIA.service')
              const productId = await inventoryIAService.saveProduct(userId, state.draftProduct)
              const replyText = `✅ *PRODUCTO PUBLICADO EN TU WEB*\n\nSe ha guardado "${state.draftProduct.name}" con éxito.\nID: ${productId}\n\nYa está disponible para tus clientes.`
              await msg.reply(replyText)
              await db.query(`INSERT INTO whatsapp_messages (user_id, customer_phone, message_body, direction, source, status, customer_pushname) VALUES ($1, $2, $3, 'outgoing', 'bot', 'sent', $4)`, [userId, customerPhone, replyText, sanitizedDisplayName])
              io.to(`user_${userId}`).emit('whatsapp_message', { userId, customerPhone, body: replyText, timestamp: Date.now(), type: 'outgoing', source: 'bot', pushname: sanitizedDisplayName })
              conversationStateService.set(userId, customerPhone, { draftProduct: null })
              return
            }
          }

          // B. Confirmar broadcast ('ENVIAR' o 'ENVIAR AHORA')
          if (cmd === 'enviar' || cmd === 'enviar ahora') {
            const state = await conversationStateService.get(userId, customerPhone)
            if (state?.draftProduct?.broadcastPlan) {
              const { broadcastService } = await import('./broadcast.service')
              const replyText = `📡 *BROADCAST INICIADO*\n\nEnviando mensajes personalizados a ${state.draftProduct.broadcastPlan.targetCount} cliente(s)...\n\nTe avisaré cuando termine. ✈️`
              await msg.reply(replyText)
              await db.query(`INSERT INTO whatsapp_messages (user_id, customer_phone, message_body, direction, source, status, customer_pushname) VALUES ($1, $2, $3, 'outgoing', 'bot', 'sent', $4)`, [userId, customerPhone, replyText, sanitizedDisplayName])
              io.to(`user_${userId}`).emit('whatsapp_message', { userId, customerPhone, body: replyText, timestamp: Date.now(), type: 'outgoing', source: 'bot', pushname: sanitizedDisplayName })
              const result = await broadcastService.execute(
                userId,
                state.draftProduct.broadcastPlan,
                async (phone, message) => {
                  await this.sendMessage(userId, phone, message)
                }
              )
              await msg.reply(`📊 *REPORTE DE BROADCAST*\n\n✅ Enviados: ${result.sent}\n❌ Fallidos: ${result.failed}\n👥 Total alcanzado: ${result.targetCount}`)
              conversationStateService.set(userId, customerPhone, { draftProduct: null })
              return
            }
          }

          // C. Cancelar broadcast ('CANCELAR')
          if (cmd === 'cancelar') {
            conversationStateService.set(userId, customerPhone, { draftProduct: null })
            await msg.reply('❌ Operación cancelada.')
            return
          }

          // D. Detectar comando de Broadcast ("Atti, envía...")
          if (messageBody.toLowerCase().includes('atti') && /envía|enviar|manda|mandar|saluda|recuerda/i.test(messageBody)) {
            const { broadcastService } = await import('./broadcast.service')
            await msg.reply('🔍 *Analizando tu comando de marketing...*')
            
            const plan = await broadcastService.parseAdminCommand(messageBody, userId)
            if (!plan) {
              await msg.reply('❌ No pude interpretar el comando. Intenta ser más específico.')
              return
            }
            
            const preview = await broadcastService.getTargetPreview(plan)
            
            if (preview.count === 0) {
              await msg.reply('⚠️ No encontré clientes que coincidan con ese segmento.')
              return
            }

            // Guardar el plan en el estado para confirmación
            conversationStateService.set(userId, customerPhone, {
              draftProduct: {
                broadcastPlan: { ...plan, targetCount: preview.count }
              }
            })

            await msg.reply(
              `📢 *PLAN DE BROADCAST LISTO*\n\n` +
              `👥 *Clientes objetivo:* ${preview.count}\n` +
              `📝 *Vista previa del mensaje:*\n\n"${plan.baseMessage.replace('{{name}}', preview.sampleNames[0] || 'Juan')}"\n\n` +
              `¿Deseas enviar esto ahora?\n\n` +
              `Responde *ENVIAR* para confirmar o *CANCELAR* para descartar.`
            )
            return
          }

          // E. Modo Admin General (Consultas con "atti")
          if (messageBody.toLowerCase().includes('atti')) {
            logger.info(`[ADMIN] Acceso autorizado para el dueño (${customerPhone}).`)
            const { aiService } = await import('./ai.service')
            const adminRes = await aiService.chat(messageBody, [], userId, customerPhone, true)
            await msg.reply(`👔 *CENTRO DE MANDO ATTI*\n\nHola Jefe, aquí tienes la información solicitada:\n\n${adminRes.text}`)
            return
          }
        }

        // 6. TRADUCCIÓN AUTOMÁTICA (Para clientes internacionales)
        const { translationService } = await import('./translation.service')
        const translation = await translationService.detectAndTranslate(messageBody)
        const effectiveMessage = translation.translatedToSpanish || messageBody

        const response = await aiOrchestrator.handleIncomingMessage(userId, customerPhone, effectiveMessage)
        
        if (response && response.text) {
          // Traducir respuesta si el cliente no habla español
          const finalTextOriginal = response.text.replace(/\[SEND_CATALOGUE_PDF\]/g, '').trim()
          const translatedText = await translationService.translateResponse(finalTextOriginal, translation.languageCode)
          const finalText = translatedText

          // Lógica de respuesta por VOZ
          let voiceSent = false
          let responseSent = false

          if (msg.type === 'ptt' || response.actions?.includes('SEND_VOICE')) {
             try {
               const { voiceTTSService } = await import('./voiceTTS.service')
               const audioPath = await voiceTTSService.textToVoiceFile(finalText)
               if (audioPath) {
                  const media = MessageMedia.fromFilePath(audioPath)
                  // IMPORTANTE: En Windows, si no hay FFmpeg instalado, sendAudioAsVoice: true genera un audio mudo o corrupto.
                  // Al enviarlo como false, se envía como un archivo MP3 de audio normal que sí se escucha perfectamente.
                  await client.sendMessage(msg.from, media, { sendAudioAsVoice: false })
                  voiceSent = true
                  responseSent = true // Bloquea el texto redundante
                  
                  // Generar URL pública y sincronizar con LiveChat
                  const fileName = path.basename(audioPath)
                  const publicUrl = `http://${process.env.IP_SERVER || 'localhost'}:4000/uploads/temp/${fileName}`
                  
                  const audioPayload = {
                    userId, customerPhone, body: finalText, mediaUrl: publicUrl,
                    timestamp: Date.now(), type: 'outgoing', source: 'bot', pushname: sanitizedDisplayName, mediaType: 'audio'
                  }
                  io.to(`user_${userId}`).emit('whatsapp_message', audioPayload)
                  await db.query(`
                    INSERT INTO whatsapp_messages (user_id, customer_phone, message_body, direction, source, status, customer_pushname, media_url, media_type)
                    VALUES ($1, $2, $3, 'outgoing', 'bot', 'sent', $4, $5, 'audio')
                  `, [userId, customerPhone, audioPayload.body, sanitizedDisplayName, publicUrl])
               }
             } catch (err: any) {
               logger.error('Error enviando nota de voz:', { error: (err as any).message })
             }
          }

          // 1. Lógica de MEDIA (Imágenes/Videos/Documentos)
          if (response.media && !response.actions?.includes('SEND_PDF')) {
            const mediaList = Array.isArray(response.media) ? response.media : [response.media]
            
            // Si hay más de un archivo multimedia (ej: QR + Boleta PDF en Checkout), 
            // enviamos el texto de resumen primero de forma limpia para evitar que un fallo en la imagen oculte el texto.
            if (mediaList.length > 1 && !voiceSent) {
              try {
                const sentMsg = await msg.reply(finalText)
                this.cacheSentMessage(sentMsg)
                responseSent = true
                
                // Sincronizar el texto con el panel
                const textPayload = {
                  userId, customerPhone, body: finalText, timestamp: Date.now(),
                  type: 'outgoing', source: 'bot', pushname: sanitizedDisplayName
                }
                await db.query(`
                  INSERT INTO whatsapp_messages (user_id, customer_phone, message_body, direction, source, status, customer_pushname)
                  VALUES ($1, $2, $3, 'outgoing', 'bot', 'sent', $4)
                `, [userId, customerPhone, finalText, sanitizedDisplayName])
                io.to(`user_${userId}`).emit('whatsapp_message', textPayload)
              } catch (txtErr: any) {
                logger.error('Error enviando texto previo de checkout:', txtErr?.message)
              }
            }

            for (let i = 0; i < mediaList.length; i++) {
              try {
                // Si enviamos el texto de forma independiente (ej. checkout multi-media), el caption de los medios individuales es vacío.
                // Si es un solo medio, se le adjunta el texto de forma clásica.
                const useSeparateText = mediaList.length > 1
                const caption = (i === 0 && !voiceSent && !useSeparateText) ? finalText : ''
                
                await this.sendMedia(userId, msg.from, mediaList[i], caption)
                responseSent = true
                
                // Sincronizar con el panel y BD
                const isVideo = mediaList[i].toLowerCase().match(/\.(mp4|mov|avi|mkv|webm|ts)/)
                const isPdf = mediaList[i].toLowerCase().endsWith('.pdf')
                const mediaType = isVideo ? 'video' : (isPdf ? 'document' : 'image')
                
                const mPayload = {
                  userId, customerPhone, body: caption || `[Archivo: ${mediaType}]`, mediaUrl: mediaList[i].startsWith('http') ? mediaList[i] : null,
                  timestamp: Date.now(), type: 'outgoing', source: 'bot', pushname: sanitizedDisplayName || 'Cliente', mediaType
                }
                io.to(`user_${userId}`).emit('whatsapp_message', mPayload)
                await db.query(`
                  INSERT INTO whatsapp_messages (user_id, customer_phone, message_body, direction, source, status, customer_pushname, media_url, media_type)
                  VALUES ($1, $2, $3, 'outgoing', 'bot', 'sent', $4, $5, $6)
                `, [userId, customerPhone, mPayload.body, sanitizedDisplayName || 'Cliente', mediaList[i].startsWith('http') ? mediaList[i] : null, mediaType])

              } catch (mediaError: any) {
                logger.error(`Error enviando imagen/documento ${i}:`, { error: mediaError?.message })
              }
            }
          }

          // 2. Lógica de PDF (Catálogo Inteligente por Tipo)
          const pdfAction = response.actions?.find(a => a.startsWith('SEND_PDF'))
          if (pdfAction) {
            const catalogType = pdfAction.split(':')[1] || 'all' // 'national', 'global', or 'all'

            // Si no enviamos media con texto, enviamos el texto solo primero (con cita)
            if (!responseSent) {
              const sentMsg = await msg.reply(finalText)
              this.cacheSentMessage(sentMsg)

              const textPayload = {
                userId, customerPhone, body: finalText, timestamp: Date.now(),
                type: 'outgoing', source: 'bot', pushname: sanitizedDisplayName
              }
              await db.query(`
                INSERT INTO whatsapp_messages (user_id, customer_phone, message_body, direction, source, status, customer_pushname)
                VALUES ($1, $2, $3, 'outgoing', 'bot', 'sent', $4)
              `, [userId, customerPhone, finalText, sanitizedDisplayName])
              io.to(`user_${userId}`).emit('whatsapp_message', textPayload)
            }
            
            try {
              const { cataloguePDFService } = await import('./cataloguePDF.service')
              
              // Verificar qué tipos de catálogo existen para este proveedor
              const { rows: types } = await db.query(
                "SELECT DISTINCT catalog_type FROM products WHERE user_id = $1 AND stock > 0",
                [userId]
              )
              const hasNational = types.some(t => t.catalog_type === 'national')
              const hasGlobal = types.some(t => t.catalog_type === 'global')

              const sendNational = (catalogType === 'national' || catalogType === 'all') && hasNational
              const sendGlobal = (catalogType === 'global' || catalogType === 'all') && hasGlobal

              // Enviar catálogo nacional si aplica
              if (sendNational) {
                const pdfPath = await cataloguePDFService.generatePDF(userId, 'national')
                const media = MessageMedia.fromFilePath(pdfPath)
                const captionText = '📦 *CATÁLOGO NACIONAL* (Entrega Inmediata)'
                this.cacheSentMessage(captionText)
                await client.sendMessage(msg.from, media, { caption: captionText })
                
                const fileName = pdfPath.split(path.sep).pop()
                const publicUrl = `http://${process.env.IP_SERVER || 'localhost'}:4000/uploads/catalogs/${fileName}`

                const pdfPayload = {
                  userId, customerPhone, body: '📄 Catálogo Nacional enviado', timestamp: Date.now(),
                  type: 'outgoing', source: 'bot', pushname: sanitizedDisplayName, 
                  mediaType: 'document', mediaUrl: publicUrl
                }
                
                await db.query(`INSERT INTO whatsapp_messages (user_id, customer_phone, message_body, direction, source, status, customer_pushname, media_type, media_url) VALUES ($1, $2, $3, 'outgoing', 'bot', 'sent', $4, 'document', $5)`, [userId, customerPhone, pdfPayload.body, sanitizedDisplayName, publicUrl])
                io.to(`user_${userId}`).emit('whatsapp_message', pdfPayload)
              }

              // Enviar catálogo global si aplica
              if (sendGlobal) {
                const pdfPath = await cataloguePDFService.generatePDF(userId, 'global')
                const media = MessageMedia.fromFilePath(pdfPath)
                const captionText = '✈️ *CATÁLOGO GLOBAL* (Importaciones)'
                this.cacheSentMessage(captionText)
                await client.sendMessage(msg.from, media, { caption: captionText })
                
                const fileName = pdfPath.split(path.sep).pop()
                const publicUrl = `http://${process.env.IP_SERVER || 'localhost'}:4000/uploads/catalogs/${fileName}`

                const pdfPayload = {
                  userId, customerPhone, body: '📄 Catálogo Global enviado', timestamp: Date.now(),
                  type: 'outgoing', source: 'bot', pushname: sanitizedDisplayName, 
                  mediaType: 'document', mediaUrl: publicUrl
                }
                
                await db.query(`INSERT INTO whatsapp_messages (user_id, customer_phone, message_body, direction, source, status, customer_pushname, media_type, media_url) VALUES ($1, $2, $3, 'outgoing', 'bot', 'sent', $4, 'document', $5)`, [userId, customerPhone, pdfPayload.body, sanitizedDisplayName, publicUrl])
                io.to(`user_${userId}`).emit('whatsapp_message', pdfPayload)
              }

              // Si el tipo pedido no tiene catálogo, avisar amablemente
              if (!sendNational && !sendGlobal) {
                const noStockMsg = catalogType === 'national'
                  ? '⚠️ Por el momento no tenemos productos nacionales en stock. ¿Te interesa ver nuestro catálogo de importaciones?'
                  : catalogType === 'global'
                    ? '⚠️ Por el momento no tenemos productos de importación disponibles. ¿Te interesa ver nuestro catálogo nacional?'
                    : '⚠️ Por el momento no tenemos catálogos disponibles. Contáctanos para más información.'
                await msg.reply(noStockMsg)
              }

              responseSent = true
            } catch (pdfError: any) {
              logger.error('Error enviando Catálogo PDF:', { error: pdfError?.message })
            }
          }

          // 3. Fallback: Si no se envió nada (ni media ni PDF), enviar solo texto
          if (!responseSent) {
            this.cacheSentMessage(finalText)
            const sentMsg = await msg.reply(finalText)
            this.cacheSentMessage(sentMsg)
            
            // Sincronizar con el panel y BD
            const textPayload = {
              userId, customerPhone, body: finalText, timestamp: Date.now(),
              type: 'outgoing', source: 'bot', pushname: sanitizedDisplayName
            }
            await db.query(`
              INSERT INTO whatsapp_messages (user_id, customer_phone, message_body, direction, source, status, customer_pushname)
              VALUES ($1, $2, $3, 'outgoing', 'bot', 'sent', $4)
            `, [userId, customerPhone, finalText, sanitizedDisplayName])
            io.to(`user_${userId}`).emit('whatsapp_message', textPayload)
          }
        }
      } catch (error: any) {
         logger.error('Error en auto-respondedor de WhatsApp:', { error: (error as any)?.message })
      }
    })

    // --- DETECTOR DE INTERVENCIÓN HUMANA (SOLO SALIDA) ---
    client.on('message_create', async (msg) => {
      // SOLO procesamos si el mensaje es enviado por el PROVEEDOR (desde su cel o web)
      // Y nos aseguramos de que no sea un mensaje que el propio BOT acaba de enviar (evitar bucle)
      if (msg.fromMe && !msg.isStatus && !msg.to.includes('@g.us')) {
        // Pausa milisegundos para permitir que Puppeteer asiente el envío y los cachés locales se actualicen
        await new Promise(resolve => setTimeout(resolve, 1500));

        // Ignorar si este mensaje lo acaba de mandar el propio bot (por ID o por texto normalizado)
        const isBot = (msg.id && msg.id._serialized && this.botSentMessagesCache.has(msg.id._serialized)) ||
                      (msg.body && this.botSentMessagesCache.has(this.normalizeForCache(msg.body)))
        if (isBot) {
          return;
        }

        // --- MEJORA DE ÉLITE: Captura de Número Real en Salida y Filtro de Sesión ---
        let customerPhone = (msg.to || '').split('@')[0]
        
        try {
          // ── PROTECCIÓN ANTI-LID (SALIDA) ──
          const recipientContact = await client.getContactById(msg.to);
          if (recipientContact) {
            const extractedNumber = recipientContact.number || (recipientContact.id && recipientContact.id.user);
            if (extractedNumber && extractedNumber.length <= 13) {
              customerPhone = extractedNumber;
            }
          }
        } catch (e) {
          // Fallback silencioso
        }

        const botNumber = client.info?.wid?.user || ''

        // 1. SEGURIDAD: Si nos escribimos a nosotros mismos, ignorar
        if (customerPhone === botNumber || customerPhone === 'status') {
          return
        }

        // En mensajes de salida, msg.getContact() nos devolvería a NOSOTROS MISMOS, no al cliente.
        // Así que usamos msg.to que ya hemos parseado en customerPhone.

        customerPhone = customerPhone.replace(/\D/g, '')
        
        // 2. FILTRO DE FANTASMAS: Si el número es inválido, ignorar
        if (!customerPhone || customerPhone.length < 7) {
          return
        }

        // ── RESOLUCIÓN NATIVA Y HEURÍSTICA DE LID (SALIDA) ──
        if (customerPhone.length > 13 && client.pupPage) {
          try {
            const rawNum = await client.pupPage.evaluate(async (lidJid) => {
              try {
                const wid = (window as any).require('WAWebWidFactory').createWid(lidJid);
                const alt = (window as any).require('WAWebApiContact').getAlternateUserWid(wid);
                return alt ? alt.user : null;
              } catch (err) {
                return null;
              }
            }, `${customerPhone}@lid`)
            if (rawNum) {
              const realNum = rawNum.replace(/\D/g, '')
              if (realNum && realNum.length <= 13) {
                logger.info(`[LID-NATIVE-FIX-OUT] Resuelto LID saliente ${customerPhone} -> Número Real: ${realNum}`)
                
                // Actualizar retroactivamente la base de datos para corregir la ID de Meta histórica
                await db.query(
                  "UPDATE whatsapp_messages SET customer_phone = $1 WHERE customer_phone = $2 AND user_id = $3",
                  [realNum, customerPhone, userId]
                )
                
                customerPhone = realNum
              }
            }
          } catch (altErr: any) {
            logger.warn(`[LID-NATIVE-FIX-OUT] No se pudo resolver alternativo nativo para ${customerPhone}: ${altErr.message || altErr}`)
          }
        }

        if (customerPhone.length > 13) {
          const suffix9 = customerPhone.slice(-9)
          const existing = await db.query(
            `SELECT DISTINCT customer_phone FROM whatsapp_messages
             WHERE user_id = $1 AND RIGHT(customer_phone, 9) = $2 AND LENGTH(customer_phone) <= 13
             LIMIT 1`,
            [userId, suffix9]
          )
          if (existing.rows.length > 0) {
            customerPhone = existing.rows[0].customer_phone
          }
        }

        const body = msg.body

        // Comandos de control (Si escribes esto, el bot te hace caso)
        const lowerBody = body.toLowerCase().trim()
        if (lowerBody === '!silencio' || lowerBody === 'pausa' || lowerBody === 'stop' || lowerBody === '!pausa') {
          const pauseUntil = Date.now() + (20 * 60 * 1000) // 20 minutos de siesta inteligente
          await conversationStateService.set(userId, customerPhone, { pausedUntil: pauseUntil })
          await client.sendMessage(msg.to, 'Entendido. Me pongo en silencio por 20 minutos. Si me necesitas antes, escribe "continua". 🤫')
          return
        }

        if (lowerBody === '!seguir' || lowerBody === '!activar' || lowerBody === 'continua' || lowerBody === 'continuar') {
          await conversationStateService.set(userId, customerPhone, { pausedUntil: 0 })
          await client.sendMessage(msg.to, '¡Recibido! Vuelvo a estar activo ahora mismo. 🤖🚀')
          return
        }

        // ELIMINADA: Detección automática de intervención (Ahora el bot no se calla solo)

        // Notificar al panel de chat
        io.to(`user_${userId}`).emit('whatsapp_message', {
          userId,
          customerPhone,
          body: msg.body,
          timestamp: Date.now(),
          type: 'outgoing',
          source: 'whatsapp_web'
        })

        // PERSISTENCIA INDUSTRIAL
        await db.query(`
          INSERT INTO whatsapp_messages (user_id, customer_phone, message_body, direction, source, status, sent_at)
          VALUES ($1, $2, $3, 'outgoing', 'whatsapp_web', 'sent', NOW())
        `, [userId, customerPhone, msg.body])
      }
    })

    // --- DOUBLE CHECK AZUL (INDICADORES DE LECTURA) ---
    client.on('message_ack', async (msg, ack) => {
      // 3 = READ, 4 = PLAYED (Audio)
      if (ack === 3 || ack === 4) {
        let customerPhone = (msg.to || '').split('@')[0]
        customerPhone = customerPhone.replace(/\D/g, '')
        
        if (!customerPhone || customerPhone.length < 7) return;

        try {
          await db.query(
            "UPDATE whatsapp_messages SET status = 'read' WHERE user_id = $1 AND customer_phone = $2 AND direction = 'outgoing' AND status != 'read'",
            [userId, customerPhone]
          )
          io.to(`user_${userId}`).emit('whatsapp_message_ack', { customerPhone, status: 'read' })
        } catch (e: any) {
          logger.warn(`[DEBUG] Error actualizando ACK: ${e.message}`)
        }
      }
    })

    client.on('authenticated', () => {
      logger.info(`WhatsApp Web autenticado para ${userId}`)
    })

    client.on('auth_failure', (msg) => {
      logger.error(`Fallo de autenticación para ${userId}: ${msg}`)
      session.status = 'disconnected'
      session.qr = undefined
      session.code = undefined
      this.sessions.delete(userId)
      io.to(`user_${userId}`).emit('whatsapp_status', { status: 'disconnected', error: msg })
    })

    client.on('disconnected', (reason) => {
      logger.info(`WhatsApp Web desconectado para ${userId}: ${reason}`)
      session.status = 'disconnected'
      session.qr = undefined
      session.code = undefined
      this.sessions.delete(userId)
      io.to(`user_${userId}`).emit('whatsapp_status', { status: 'disconnected' })
    })

    // No bloquear el hilo principal
    client.initialize().catch(err => {
      logger.error(`Error inicializando cliente para ${userId}: ${err?.stack || err?.message || err}`)
      session.status = 'disconnected'
      session.qr = undefined
      session.code = undefined
      this.sessions.delete(userId)
      
      // Auto-reparación: Eliminar caché corrupta si Chrome falla
      const sessionPath = path.resolve(process.cwd(), '.wwebjs_auth', `session-${userId}`)
      if (fs.existsSync(sessionPath)) {
        try {
          fs.rmSync(sessionPath, { recursive: true, force: true })
          logger.info(`Caché corrupta de WhatsApp limpiada para ${userId}`)
        } catch (rmErr: any) {
          logger.warn(`No se pudo eliminar completamente la caché de sesión para ${userId}: ${rmErr.message}`)
        }
      }
      
      io.to(`user_${userId}`).emit('whatsapp_status', { 
         status: 'error', 
         error: 'Error de motor interno. Por favor, reintenta.' 
      })
    })

    return session
  }

  private async sendMetaFallbackMessage(to: string, message: string) {
    const token = process.env.META_SYSTEM_ACCESS_TOKEN;
    const phoneId = process.env.META_SYSTEM_PHONE_NUMBER_ID;
    
    if (!token || !phoneId) {
      throw new Error('WhatsApp Web desconectado y NO hay credenciales de Meta API configuradas para el Fallback Global.');
    }

    const cleanPhone = to.replace(/\D/g, '');
    
    const payload = {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: cleanPhone,
      type: "text",
      text: { body: message }
    };

    logger.info(`[FALLBACK] Enrutando mensaje vía Meta API (Super Admin) a ${cleanPhone}...`);

    try {
      const response = await fetch(`https://graph.facebook.com/v25.0/${phoneId}/messages`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      const data: any = await response.json();
      
      if (!response.ok) {
        // Manejar errores específicos como el token vencido (190)
        if (data.error && data.error.code === 190) {
          logger.error(`Error crítico: Token de Meta API vencido o inválido. Debes actualizar META_SYSTEM_ACCESS_TOKEN.`, { fbtrace_id: data.error.fbtrace_id });
          throw new Error(`Fallo en Meta API: Token vencido (Code 190)`);
        }
        logger.error(`Error en Meta API Fallback:`, data);
        throw new Error(`Fallo en Meta API: ${JSON.stringify(data)}`);
      }

      logger.info(`✅ [FALLBACK] Mensaje enviado exitosamente vía Meta API a ${cleanPhone}`);
      return true;
    } catch (err: any) {
      logger.error('Error crítico al conectar con Meta API:', err.message);
      throw err;
    }
  }

  async sendMessage(userId: string, to: string, message: string) {
    try {
      const session = await this.getSession(userId)
      if (session.status !== 'connected') {
        logger.warn(`⚠️ WhatsApp Web NO conectado para el proveedor ${userId}. El mensaje no se puede enviar.`)
        return false
      }

      // Si 'to' ya es un JID (contiene @), usarlo directo
      const chatId = to.includes('@') 
        ? to 
        : `${to.replace(/\D/g, '')}${to.replace(/\D/g, '').length > 13 ? '@lid' : '@c.us'}`
      
      // --- ANTI-BUCLE AUTOMÁTICO ---
      this.cacheSentMessage(message)

      // --- RESOLUCIÓN NATIVA DE CONTACTOS (Previene error "No LID") ---
      let finalChatId = chatId
      try {
        const rawNumber = to.replace(/\D/g, '')
        const numberId = await session.client.getNumberId(rawNumber)
        if (numberId) {
          finalChatId = numberId._serialized
        }
      } catch (e) {
        logger.warn(`[WA-WEB] No se pudo pre-resolver el número ${to}, intentando envío directo...`)
      }

      const sentMsg = await session.client.sendMessage(finalChatId, message)
      this.cacheSentMessage(sentMsg)
      logger.info(`Mensaje enviado vía WhatsApp Web a ${finalChatId}`)

      // --- SINCRONIZACIÓN EN TIEMPO REAL CON EL PANEL ---
      io.to(`user_${userId}`).emit('whatsapp_message', {
        userId,
        customerPhone: to.replace(/\D/g, ''),
        body: message,
        timestamp: Date.now(),
        type: 'outgoing',
        source: 'whatsapp_web',
        status: 'sent'
      })

      // --- PERSISTENCIA INDUSTRIAL: Guardar mensaje saliente ---
      await db.query(`
        INSERT INTO whatsapp_messages (user_id, customer_phone, message_body, direction, source, status, sent_at)
        VALUES ($1, $2, $3, 'outgoing', 'whatsapp_web', 'sent', NOW())
      `, [userId, to.replace(/\D/g, ''), message])

      return true
    } catch (error: any) {
      const errMsg = error?.message || error?.toString() || 'Error desconocido'
      logger.error(`Error enviando mensaje vía WhatsApp Web: ${errMsg}`, { stack: error?.stack })

      // Activar fallback ante CUALQUIER fallo de conexión/envío
      const isConnectionError = errMsg.includes('conectado')
        || errMsg.includes('Session closed')
        || errMsg.includes('Protocol error')
        || errMsg.includes('Target closed')
        || errMsg.includes('not open')
        || errMsg.includes('ECONNRESET')
        || errMsg.includes('No LID')

      if (isConnectionError) {
        logger.warn(`⚠️ Error de conexión en WhatsApp Web para ${userId}: ${errMsg}. El mensaje se pondrá en cola para reintento.`)
        // Retornamos falso para que el sistema de enrutamiento sepa que falló y lo ponga en cola
        return false
      }
      // Para errores no relacionados con conexión, lanzar para que el caller decida
      throw error
    }
  }

  async sendMedia(userId: string, to: string, urlOrPath: string, caption?: string) {
    try {
      const session = await this.getSession(userId)
      if (session.status !== 'connected') {
        logger.warn(`⚠️ WhatsApp Web NO conectado para el proveedor ${userId}. El archivo multimedia no se puede enviar.`)
        throw new Error('WhatsApp no está conectado')
      }

      // Si 'to' ya es un JID (contiene @), usarlo directo
      const chatId = to.includes('@') 
        ? to 
        : `${to.replace(/\D/g, '')}${to.replace(/\D/g, '').length > 13 ? '@lid' : '@c.us'}`
      
      // --- RESOLUCIÓN NATIVA DE CONTACTOS ---
      let finalChatId = chatId
      try {
        const rawNumber = to.replace(/\D/g, '')
        const numberId = await session.client.getNumberId(rawNumber)
        if (numberId) finalChatId = numberId._serialized
      } catch (e) {}

      let media: any
      logger.info(`Intentando enviar media a ${finalChatId}: ${urlOrPath.substring(0, 50)}...`)

      let resolvedPath = urlOrPath
      const isHttp = urlOrPath.startsWith('http')
      const isData = urlOrPath.startsWith('data:')

      if (!isHttp && !isData) {
        // Corrección de Rutas Locales en Windows/Linux para el Módulo de Carga
        const cleanPath = urlOrPath.startsWith('/') ? urlOrPath.slice(1) : urlOrPath
        if (!path.isAbsolute(urlOrPath) || urlOrPath.startsWith('/uploads') || urlOrPath.startsWith('uploads')) {
          resolvedPath = path.join(process.cwd(), cleanPath)
        }
      }

      if (isHttp) {
        const isVideo = urlOrPath.toLowerCase().match(/\.(mp4|mov|avi|mkv|webm|ts)/)
        if (isVideo) {
          media = await MessageMedia.fromUrl(urlOrPath, { unsafeMime: true })
          if (media) media.mimetype = 'video/mp4'
        } else {
          media = await MessageMedia.fromUrl(urlOrPath, { unsafeMime: true })
        }
      } else if (isData) {
        const matches = urlOrPath.match(/^data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+);base64,(.+)$/)
        if (matches && matches.length === 3) {
          media = new MessageMedia(matches[1], matches[2])
        } else {
          logger.error('Formato Data URI inválido detectado')
          throw new Error('Formato Data URI inválido')
        }
      } else {
        if (!fs.existsSync(resolvedPath)) {
          throw new Error(`Archivo local no encontrado en la ruta resuelta: ${resolvedPath}`)
        }
        media = MessageMedia.fromFilePath(resolvedPath)
      }

      if (!media) throw new Error('No se pudo cargar el recurso multimedia')

      const sentMsg = await session.client.sendMessage(finalChatId, media, { caption })
      this.cacheSentMessage(sentMsg)
      if (caption) {
        this.cacheSentMessage(caption)
      }

      const isVideo = urlOrPath.toLowerCase().match(/\.(mp4|mov|avi|mkv|webm|ts)/)
      const isPdf = urlOrPath.toLowerCase().endsWith('.pdf')
      const mediaType = isVideo ? 'video' : (isPdf ? 'document' : 'image')

      io.to(`user_${userId}`).emit('whatsapp_message', {
        userId,
        customerPhone: to.replace(/\D/g, ''),
        body: caption || `[${mediaType.toUpperCase()}]`,
        mediaUrl: urlOrPath.startsWith('http') ? urlOrPath : null,
        timestamp: Date.now(),
        type: 'outgoing',
        source: 'whatsapp_web',
        status: 'sent',
        mediaType
      })

      // --- PERSISTENCIA INDUSTRIAL: Guardar mensaje saliente con media ---
      await db.query(`
        INSERT INTO whatsapp_messages (user_id, customer_phone, message_body, direction, source, status, sent_at, media_url, media_type)
        VALUES ($1, $2, $3, 'outgoing', 'whatsapp_web', 'sent', NOW(), $4, $5)
      `, [userId, to.replace(/\D/g, ''), caption || `[Archivo ${mediaType}]`, urlOrPath.startsWith('http') ? urlOrPath : null, mediaType])

      return true
    } catch (error: any) {
      logger.error('Error enviando media vía WhatsApp Web:', { 
        error: (error as any).message, 
        stack: (error as any).stack,
        urlPrefix: urlOrPath?.substring(0, 100) 
      })
      throw error
    }
  }

  async getProfilePicUrl(userId: string, phone: string): Promise<string | null> {
    try {
      const session = this.sessions.get(userId)
      if (!session || session.status !== 'connected') return null

      const chatId = phone.includes('@') 
        ? phone 
        : `${phone.replace(/\D/g, '')}${phone.replace(/\D/g, '').length > 13 ? '@lid' : '@c.us'}`
      const url = await session.client.getProfilePicUrl(chatId)
      return url || null
    } catch (e) {
      return null
    }
  }

  async disconnect(userId: string) {
    const session = this.sessions.get(userId)
    if (session) {
      await session.client.logout()
      this.sessions.delete(userId)
    }
  }

  async shutdownAll() {
    for (const [userId, session] of this.sessions.entries()) {
      try {
        if (session.client) {
          logger.info(`[SHUTDOWN] Destruyendo instancia de Puppeteer para ${userId}...`)
          await session.client.destroy()
        }
      } catch (e) {
        logger.error(`[SHUTDOWN] Error destruyendo cliente de ${userId}`, e as any)
      }
    }
  }
}

export const whatsappWebManager = new WhatsAppWebManager()
