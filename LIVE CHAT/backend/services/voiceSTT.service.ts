import axios from 'axios'
import FormData from 'form-data'
import { logger } from '../api/utils/logger'
import { Readable } from 'stream'

export class VoiceSTTService {
  /**
   * Transcribe un audio de WhatsApp usando Groq Whisper (Ultra rápido y preciso)
   */
  async transcribe(base64Data: string): Promise<string> {
    try {
      const { keyManager } = await import('./ai.service')
      const instance = keyManager.getAvailableInstance()
      
      if (!instance) {
        throw new Error("No hay llaves de Groq disponibles en el pool")
      }

      // Encontrar la llave en el objeto devuelto por getAvailableInstance
      // El objeto es { groq, keyIndex }, pero necesitamos la llave cruda para el header de axios
      const apiKey = (instance.groq as any).apiKey

      const audioBuffer = Buffer.from(base64Data, 'base64')
      
      const formData = new FormData()
      // Enviar como .ogg (formato nativo de WA)
      formData.append('file', audioBuffer, {
        filename: 'audio.ogg',
        contentType: 'audio/ogg',
      })
      formData.append('model', 'whisper-large-v3')
      formData.append('language', 'es') // Forzar español para mayor precisión

      const response = await axios.post(
        'https://api.groq.com/openai/v1/audio/transcriptions',
        formData,
        {
          headers: {
            ...formData.getHeaders(),
            'Authorization': `Bearer ${apiKey}`,
          },
        }
      )

      return response.data.text || ""
    } catch (error: any) {
      logger.error('Error en Transcripción de Voz Groq:', error?.response?.data || error.message)
      return ""
    }
  }
}

export const voiceSTTService = new VoiceSTTService()
