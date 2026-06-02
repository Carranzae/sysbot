import axios from 'axios'
import { logger } from '../api/utils/logger'
import fs from 'fs'
import path from 'path'
import { db } from '../database/db'
import { fastCache } from '../api/utils/cache'

export interface TTSProvider {
  generate(text: string): Promise<Buffer>
}

/**
 * Proveedor Gratuito (Google Translate TTS)
 * Limitado a 200 caracteres por segmento, pero es 100% gratis.
 */
class GoogleTTSProvider implements TTSProvider {
  async generate(text: string): Promise<Buffer> {
    try {
      // Google TTS tiene un límite de 200 caracteres por petición.
      // Dividimos el texto en fragmentos lógicos (por oraciones o espacios).
      const chunks = this.splitText(text, 200)
      const buffers: Buffer[] = []

      for (const chunk of chunks) {
        const url = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(chunk)}&tl=es&client=tw-ob`
        const response = await axios.get(url, { responseType: 'arraybuffer' })
        buffers.push(Buffer.from(response.data))
      }

      return Buffer.concat(buffers)
    } catch (err: any) {
      logger.error('Error en GoogleTTSProvider:', { error: err.message })
      throw err
    }
  }

  private splitText(text: string, maxLength: number): string[] {
    const chunks: string[] = []
    let current = text

    while (current.length > maxLength) {
      // Intentar cortar en el último espacio antes del límite
      let cutAt = current.lastIndexOf(' ', maxLength)
      if (cutAt === -1) cutAt = maxLength // Si no hay espacio, cortar a la fuerza

      chunks.push(current.substring(0, cutAt).trim())
      current = current.substring(cutAt).trim()
    }

    if (current.length > 0) chunks.push(current)
    return chunks
  }
}

/**
 * Proveedor Premium (OpenAI) - Listo para activar con API KEY
 */
class OpenAITTSProvider implements TTSProvider {
  private apiKey: string
  constructor(apiKey: string) {
    this.apiKey = apiKey
  }
  async generate(text: string): Promise<Buffer> {
    try {
      // Cargar configuraciones de voz en vivo con caché de respaldo (HD por defecto para máxima fidelidad)
      let model = 'tts-1-hd'
      let voice = 'nova' // Nova es una voz femenina, cálida y súper amigable
      let speed = 1.0

      try {
        const cacheKey = 'site:global_settings'
        const cached = await fastCache.get(cacheKey)
        let settings = cached
        if (!settings) {
          const { rows } = await db.query('SELECT value FROM site_settings WHERE id = $1', ['global_settings'])
          settings = rows[0]?.value
        }
        if (settings) {
          if (settings.voiceModel) model = settings.voiceModel
          if (settings.voiceName) voice = settings.voiceName
          if (settings.voiceSpeed) speed = Number(settings.voiceSpeed) || 1.0
        }
      } catch (dbErr) {
        logger.error('⚠️ [TTS OpenAI] Error consultando configuraciones de voz, usando defaults:', dbErr as any)
      }

      const response = await axios.post(
        'https://api.openai.com/v1/audio/speech',
        {
          model,
          voice,
          input: text,
          speed
        },
        {
          headers: { Authorization: `Bearer ${this.apiKey}` },
          responseType: 'arraybuffer',
        }
      )
      return Buffer.from(response.data)
    } catch (err: any) {
      logger.error('Error en OpenAITTSProvider:', { error: err.message })
      throw err
    }
  }
}

/**
 * Proveedor Ultra-Premium (ElevenLabs) - La mejor síntesis de voz humana del mundo.
 */
class ElevenLabsTTSProvider implements TTSProvider {
  private apiKey: string
  constructor(apiKey: string) {
    this.apiKey = apiKey
  }
  async generate(text: string): Promise<Buffer> {
    try {
      let voiceId = '21m00Tcm4TlvDq8ikWAM' // Voz 'Rachel' (femenina, natural, amigable, excelente español)
      
      try {
        const cacheKey = 'site:global_settings'
        const cached = await fastCache.get(cacheKey)
        let settings = cached
        if (!settings) {
          const { rows } = await db.query('SELECT value FROM site_settings WHERE id = $1', ['global_settings'])
          settings = rows[0]?.value
        }
        if (settings && settings.elevenLabsVoiceId) {
          voiceId = settings.elevenLabsVoiceId
        }
      } catch (dbErr) {
        logger.error('⚠️ [TTS ElevenLabs] Error consultando configuración de voz:', dbErr as any)
      }

      const response = await axios.post(
        `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
        {
          text,
          model_id: 'eleven_multilingual_v2',
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75
          }
        },
        {
          headers: {
            'xi-api-key': this.apiKey,
            'Content-Type': 'application/json'
          },
          responseType: 'arraybuffer'
        }
      )
      return Buffer.from(response.data)
    } catch (err: any) {
      logger.error('Error en ElevenLabsTTSProvider:', { error: err.message })
      throw err
    }
  }
}

export class VoiceTTSService {
  private provider: TTSProvider

  constructor() {
    if (process.env.ELEVENLABS_API_KEY) {
      this.provider = new ElevenLabsTTSProvider(process.env.ELEVENLABS_API_KEY)
      logger.info('Voz: Usando ElevenLabs TTS (Ultra-Premium / Humano Real) 🎙️')
    } else if (process.env.OPENAI_API_KEY) {
      this.provider = new OpenAITTSProvider(process.env.OPENAI_API_KEY)
      logger.info('Voz: Usando OpenAI TTS (Premium HD) 🎧')
    } else {
      this.provider = new GoogleTTSProvider()
      logger.info('Voz: Usando Google TTS (Gratis)')
    }
  }

  /**
   * Cambia el proveedor en caliente (para multi-agente)
   */
  setProvider(provider: TTSProvider) {
    this.provider = provider
  }

  /**
   * Genera un audio a partir de texto y devuelve el path del archivo temporal
   */
  async textToVoiceFile(text: string): Promise<string | null> {
    try {
      // Limpieza avanzada de texto para voz (Eliminar Markdown, Comandos y EMOJIS)
      let cleanText = text
        .replace(/\[[^\]]+\]/g, '')  // Eliminar comandos como [SEND_PDF]
        .replace(/\*\*/g, '')        // Eliminar negritas
        .replace(/\*/g, '')          // Eliminar itálicas
        .replace(/#/g, '')           // Eliminar títulos
        .replace(/_/g, '')           // Eliminar guiones bajos
        .replace(/`/g, '')           // Eliminar backticks
        .replace(/━+/g, '')          // Eliminar separadores decorativos
        .replace(/—+/g, ', ')        // Convertir guiones largos en pausa natural
        // ── ELIMINACIÓN COMPLETA DE EMOJIS Y SÍMBOLOS UNICODE ────────────
        // El TTS NO debe leer "chart increasing", "check mark", "airplane", etc.
        .replace(/[\u{1F300}-\u{1F5FF}]/gu, '') // Misc Symbols & Pictographs
        .replace(/[\u{1F600}-\u{1F64F}]/gu, '') // Emoticons (caritas)
        .replace(/[\u{1F680}-\u{1F6FF}]/gu, '') // Transport & Map Symbols
        .replace(/[\u{1F700}-\u{1F77F}]/gu, '') // Alchemical Symbols
        .replace(/[\u{1F780}-\u{1F7FF}]/gu, '') // Geometric Shapes Extended
        .replace(/[\u{1F800}-\u{1F8FF}]/gu, '') // Supplemental Arrows-C
        .replace(/[\u{1F900}-\u{1F9FF}]/gu, '') // Supplemental Symbols
        .replace(/[\u{1FA00}-\u{1FA6F}]/gu, '') // Chess Symbols
        .replace(/[\u{1FA70}-\u{1FAFF}]/gu, '') // Symbols and Pictographs Extended
        .replace(/[\u{2600}-\u{26FF}]/gu, '')   // Misc Symbols (☀ ⭐ ✅ ❌ etc.)
        .replace(/[\u{2700}-\u{27BF}]/gu, '')   // Dingbats
        .replace(/[\u{FE00}-\u{FE0F}]/gu, '')   // Variation Selectors
        .replace(/[\u{1F1E0}-\u{1F1FF}]/gu, '') // Flags (banderas)
        .replace(/[\u{E0000}-\u{E007F}]/gu, '') // Tags
        .replace(/[^\p{L}\p{N}\p{Z}\p{P}]/gu, '') // Eliminar cualquier otro símbolo no alfabético/numérico/puntuación
        .replace(/\s{2,}/g, ' ')     // Colapsar espacios múltiples
        .trim()

      if (!cleanText) return null

      // ── TRUNCADO INTELIGENTE PARA WHATSAPP ────────────────────────────
      // Audios de más de 180 chars son ilegibles en WA. Extraemos solo la
      // primera oración o el primer párrafo informativo breve.
      const MAX_TTS_CHARS = 180
      if (cleanText.length > MAX_TTS_CHARS) {
        // Intentar cortar en el primer punto, signo de exclamación o salto de línea
        const breakpoints = ['. ', '! ', '? ', '\n', ': ']
        let bestCut = -1
        for (const bp of breakpoints) {
          const idx = cleanText.indexOf(bp)
          if (idx > 20 && idx <= MAX_TTS_CHARS) {
            bestCut = idx + bp.length - 1
            break
          }
        }
        if (bestCut > 0) {
          cleanText = cleanText.substring(0, bestCut).trim()
        } else {
          // Fallback: cortar en el último espacio antes del límite
          cleanText = cleanText.substring(0, MAX_TTS_CHARS).replace(/\s+\S*$/, '').trim() + '...'
        }
        logger.info(`[TTS] Texto truncado a ${cleanText.length} chars para audio corto de WhatsApp`)
      }

      const buffer = await this.provider.generate(cleanText)
      
      const fileName = `voice_${Date.now()}.mp3`
      const tempDir = path.join(process.cwd(), 'uploads', 'temp')
      const filePath = path.join(tempDir, fileName)

      if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true })
      
      fs.writeFileSync(filePath, buffer)
      return filePath
    } catch (err: any) {
      logger.error('Error generando archivo de voz:', { error: err.message })
      return null
    }
  }
}

export const voiceTTSService = new VoiceTTSService()
