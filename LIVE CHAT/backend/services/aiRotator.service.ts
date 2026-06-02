import { GoogleGenerativeAI } from '@google/generative-ai'
import { config } from '../config/env'
import { logger } from '../api/utils/logger'
import fs from 'fs'
import path from 'path'
import * as dotenv from 'dotenv'
import Groq from 'groq-sdk'

export class AiRotatorService {
  private currentKeyIndex = 0
  private keys: string[] = []
  // Mapa de cooldowns: Key -> Timestamp en el que volverá a estar disponible
  private cooldowns = new Map<string, number>()
  private lastReloadTime = 0
  private RELOAD_INTERVAL = 30000 // Recargar cada 30 segundos si es necesario

  // Groq keys para fallback de visión
  private groqKeys: string[] = []
  private groqKeyIndex = 0

  constructor() {
    this.reloadKeysFromEnvFile(true)
    if (this.keys.length === 0) {
      logger.error('❌ [AI-ROTATOR] No hay llaves de Gemini configuradas.')
    } else {
      logger.info(`🔄 [AI-ROTATOR] Motor inteligente listo con ${this.keys.length} llaves Gemini + ${this.groqKeys.length} llaves Groq (fallback visión).`)
    }
  }

  /**
   * Permite recargar el .env "en caliente" sin reiniciar el servidor
   */
  public reloadKeysFromEnvFile(force = false) {
    const now = Date.now()
    if (!force && now - this.lastReloadTime < this.RELOAD_INTERVAL) return

    try {
      const envPath = path.resolve(process.cwd(), '.env')
      if (!fs.existsSync(envPath)) return

      const envContent = fs.readFileSync(envPath, 'utf-8')
      const envConfig = dotenv.parse(envContent)
      
      // Cargar llaves Gemini
      let allKeysString = ''
      for (const [envKey, envValue] of Object.entries(envConfig)) {
        if (envKey.startsWith('GEMINI_API_KEY') && envValue) {
          allKeysString += envValue + ','
        }
      }

      const rawKeys = allKeysString
        .replace(/"/g, '')
        .split(',')
        .map(k => k.trim())
        .filter(k => k.length >= 30 && !k.includes('<') && !k.toLowerCase().includes('pendiente'))
      
      if (this.keys.length > 0 && rawKeys.length > this.keys.length) {
         logger.info(`✅ [AI-ROTATOR] Detectadas nuevas llaves de Gemini en caliente. Total en rotación: ${rawKeys.length}`)
      }
      
      this.keys = rawKeys

      // Cargar llaves Groq para fallback
      let groqKeysString = ''
      for (const [envKey, envValue] of Object.entries(envConfig)) {
        if (envKey.includes('GROQ_API_KEY') && envValue) {
          groqKeysString += envValue + ','
        }
      }
      this.groqKeys = groqKeysString
        .split(',')
        .map(k => k.replace(/['"\[\]]/g, '').trim())
        .filter(k => k && k.startsWith('gsk_'))

      this.lastReloadTime = now
    } catch (e) {
      logger.error('Error recargando llaves de Gemini desde .env', e as any)
    }
  }

  /**
   * Obtiene las llaves activas que NO están en cooldown
   */
  private getActiveKeys(): string[] {
    this.reloadKeysFromEnvFile()
    const now = Date.now()
    return this.keys.filter(k => {
      const exp = this.cooldowns.get(k)
      // Está activa si no tiene cooldown o si ya expiró
      if (exp && exp <= now) {
        this.cooldowns.delete(k) // Limpiar
        return true
      }
      return !exp
    })
  }

  /**
   * Obtiene la siguiente instancia de GenAI disponible (Round Robin sobre llaves activas)
   */
  getGenAI(): GoogleGenerativeAI {
    const activeKeys = this.getActiveKeys()
    if (activeKeys.length === 0) {
      throw new Error('Todas las llaves de Gemini están en cooldown temporal. Intenta en un momento.')
    }

    const key = activeKeys[this.currentKeyIndex % activeKeys.length]
    // Rotar para la siguiente llamada
    this.currentKeyIndex = (this.currentKeyIndex + 1) % activeKeys.length

    return new GoogleGenerativeAI(key)
  }

  /**
   * Obtiene un modelo específico con la llave actual rotada
   */
  getModel(modelName: string = 'gemini-2.0-flash') {
    const genAI = this.getGenAI()
    return genAI.getGenerativeModel({ model: modelName })
  }

  /**
   * 🛡️ FALLBACK: Ejecuta una operación de visión usando Groq (llama-4-scout)
   * cuando todas las llaves de Gemini están agotadas.
   */
  private async executeWithGroqFallback(base64Data: string, prompt: string): Promise<any> {
    if (this.groqKeys.length === 0) {
      throw new Error('❌ [AI-ROTATOR] Sin llaves Groq de respaldo para visión.')
    }

    for (let i = 0; i < this.groqKeys.length; i++) {
      const keyIdx = (this.groqKeyIndex + i) % this.groqKeys.length
      const groqKey = this.groqKeys[keyIdx]

      try {
        const groq = new Groq({ apiKey: groqKey })

        // Limpiar base64 si tiene prefijo data:image/...
        const cleanBase64 = base64Data.includes(',') ? base64Data.split(',')[1] : base64Data
        const imageUrl = `data:image/jpeg;base64,${cleanBase64}`

        const completion = await groq.chat.completions.create({
          model: 'llama-4-scout-17b-16e-instruct',
          messages: [
            {
              role: 'user',
              content: [
                { type: 'text', text: prompt },
                { type: 'image_url', image_url: { url: imageUrl } }
              ]
            }
          ],
          temperature: 0.2,
          max_completion_tokens: 1024,
        }, { timeout: 15000 })

        this.groqKeyIndex = (keyIdx + 1) % this.groqKeys.length
        const text = completion.choices[0]?.message?.content || ''
        logger.info(`✅ [GROQ-VISION-FALLBACK] Análisis exitoso con Groq llave #${keyIdx + 1}`)

        // Simular la estructura de respuesta de Gemini para compatibilidad
        return {
          response: {
            text: () => text
          }
        }
      } catch (err: any) {
        logger.warn(`⚠️ [GROQ-VISION-FALLBACK] Llave Groq #${keyIdx + 1} falló: ${err.message}`)
        continue
      }
    }

    throw new Error('❌ [AI-ROTATOR] Todas las llaves (Gemini + Groq) están agotadas.')
  }

  /**
   * Ejecuta una operación con IA y reintenta con otra llave si falla.
   * Si todas las llaves de Gemini fallan, usa Groq como respaldo para visión.
   */
  async executeWithRetry<T>(operation: (model: any) => Promise<T>, modelName: string = 'gemini-2.0-flash', visionFallbackData?: { base64: string; prompt: string }): Promise<T> {
    let lastError: any = null
    const maxRetries = Math.max(this.keys.length, 4)

    for (let i = 0; i < maxRetries; i++) {
      const activeKeys = this.getActiveKeys()
      if (activeKeys.length === 0) {
        break // Salir del loop de Gemini para intentar Groq fallback
      }

      // Capturar la llave que se está usando antes de intentar
      const currentKey = activeKeys[this.currentKeyIndex % activeKeys.length]

      try {
        const model = this.getModel(modelName)
        return await operation(model)
      } catch (error: any) {
        lastError = error
        const errMsg: string = error.message || ''

        // 🔴 LLAVE TOTALMENTE INVÁLIDA O REVOCADA — Cooldown de 1 minuto (a petición del usuario)
        const isInvalidKey = errMsg.includes('API_KEY_INVALID') ||
                             errMsg.includes('API key not valid') ||
                             errMsg.includes('not valid') ||
                             (error.status === 400 && errMsg.toLowerCase().includes('key'))
        if (isInvalidKey) {
          const COOLDOWN_1M = 60 * 1000 // 1 minuto
          this.cooldowns.set(currentKey, Date.now() + COOLDOWN_1M)
          const keyNum = this.keys.indexOf(currentKey) + 1
          logger.error(`🚫 [AI-ROTATOR] Llave ${keyNum} INVÁLIDA/EXPIRADA. Enfriando por 1 minuto. Llaves activas: ${this.getActiveKeys().length}`)
          continue // Intentar con la siguiente
        }

        // 🟡 RATE LIMIT / CUOTA TEMPORAL (429) — Cooldown de 1 minuto
        const isPayloadLimit = errMsg.toLowerCase().includes('size') || errMsg.toLowerCase().includes('payload') || errMsg.toLowerCase().includes('too large')
        const isRateLimit = (errMsg.includes('429') || 
                            errMsg.toLowerCase().includes('quota') || 
                            (errMsg.toLowerCase().includes('limit') && !isPayloadLimit) || 
                            error.status === 429)

        if (isRateLimit) {
          const COOLDOWN_1M = 60 * 1000 // 1 minuto
          this.cooldowns.set(currentKey, Date.now() + COOLDOWN_1M)
          const keyNum = this.keys.indexOf(currentKey) + 1
          logger.warn(`⚠️ [AI-ROTATOR] Llave ${keyNum} con límite de cuota o error (429/limit). Enfriando por 1 min. Rotando...`)
          continue
        }

        // Cualquier otro error (prompt inválido, etc.) — no reintentar
        throw error
      }
    }

    // 🛡️ FALLBACK A GROQ: Si todas las llaves de Gemini fallaron y tenemos datos de visión
    if (visionFallbackData) {
      logger.warn(`🔄 [AI-ROTATOR] Todas las llaves Gemini agotadas. Activando GROQ VISION como respaldo...`)
      try {
        return await this.executeWithGroqFallback(visionFallbackData.base64, visionFallbackData.prompt) as T
      } catch (groqError: any) {
        logger.error(`❌ [AI-ROTATOR] Groq fallback también falló: ${groqError.message}`)
      }
    }

    throw lastError || new Error('❌ [AI-ROTATOR] Todas las llaves de Gemini están en cooldown (agotadas o sin cuota).')
  }

  /**
   * Obtiene estadísticas de telemetría del rotador de llaves
   */
  getStats() {
    this.reloadKeysFromEnvFile()
    const now = Date.now()
    const totalKeys = this.keys.length
    const activeKeys = this.getActiveKeys()
    const cooldownKeys = Array.from(this.cooldowns.entries()).map(([key, exp]) => {
      const remainingSeconds = Math.max(0, Math.round((exp - now) / 1000))
      return {
        keyIndex: this.keys.indexOf(key) + 1,
        remainingSeconds,
        type: remainingSeconds > 70 ? 'invalid_or_expired' : 'rate_limit_cooldown'
      }
    })

    return {
      totalKeys,
      activeKeysCount: activeKeys.length,
      cooldownKeysCount: this.cooldowns.size,
      cooldownKeys,
      groqFallbackKeys: this.groqKeys.length
    }
  }
}

export const aiRotatorService = new AiRotatorService()

