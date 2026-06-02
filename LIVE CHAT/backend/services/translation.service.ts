import { aiService } from './ai.service'
import { logger } from '../api/utils/logger'

// Idiomas soportados con su código ISO
const SUPPORTED_LANGUAGES: Record<string, string> = {
  'en': 'English',
  'pt': 'Português',
  'fr': 'Français',
  'zh': '中文',
  'it': 'Italiano',
  'de': 'Deutsch',
  'es': 'Español',
}

export interface TranslationResult {
  detectedLanguage: string
  languageCode: string
  isSpanish: boolean
  translatedToSpanish?: string // Mensaje del cliente traducido para la IA
}

export class TranslationService {
  /**
   * Detecta el idioma del mensaje y lo traduce al español para que la IA lo entienda.
   */
  async detectAndTranslate(message: string): Promise<TranslationResult> {
    // Si es muy corto (1-2 palabras), asumir español para no gastar créditos
    if (message.trim().split(/\s+/).length < 3) {
      return { detectedLanguage: 'Español', languageCode: 'es', isSpanish: true }
    }

    try {
      const prompt = `Detecta el idioma del siguiente texto y si NO es español, tradúcelo al español.
      
      Texto: "${message}"
      
      Responde SOLO en JSON:
      {
        "languageCode": "es|en|pt|fr|zh|it|de",
        "isSpanish": boolean,
        "translatedToSpanish": "texto en español si no era español, si era español pon null"
      }`

      const result = await aiService.chat(prompt)
      const text = result.text.replace(/```json|```/g, '').trim()
      const parsed = JSON.parse(text)

      return {
        detectedLanguage: SUPPORTED_LANGUAGES[parsed.languageCode] || parsed.languageCode,
        languageCode: parsed.languageCode || 'es',
        isSpanish: parsed.isSpanish,
        translatedToSpanish: parsed.translatedToSpanish || undefined,
      }
    } catch (err: any) {
      logger.warn('[TRANSLATION] Error detectando idioma, asumiendo español.', { error: err.message })
      return { detectedLanguage: 'Español', languageCode: 'es', isSpanish: true }
    }
  }

  /**
   * Traduce la respuesta de la IA al idioma del cliente.
   */
  async translateResponse(text: string, targetLanguageCode: string): Promise<string> {
    if (targetLanguageCode === 'es') return text

    try {
      // Extraer comandos del texto para no traducirlos
      const commands: string[] = []
      const commandRegex = /\[([^\]]+)\]/g
      let match
      while ((match = commandRegex.exec(text)) !== null) {
        commands.push(match[0])
      }

      const textWithoutCommands = text.replace(/\[[^\]]+\]/g, '___CMD___')
      const targetLang = SUPPORTED_LANGUAGES[targetLanguageCode] || targetLanguageCode

      const prompt = `Traduce el siguiente texto al ${targetLang}. Mantén los emojis y el tono persuasivo. No traduzcas "___CMD___", déjalo exactamente igual.
      
      Texto: "${textWithoutCommands}"
      
      Responde SOLO con la traducción, sin explicaciones.`

      const result = await aiService.chat(prompt)
      let translated = result.text.trim()

      // Restaurar los comandos
      let cmdIdx = 0
      translated = translated.replace(/___CMD___/g, () => commands[cmdIdx++] || '')

      return translated
    } catch (err: any) {
      logger.warn('[TRANSLATION] Error traduciendo respuesta, enviando en español.', { error: err.message })
      return text
    }
  }
}

export const translationService = new TranslationService()
