import { aiRotatorService } from './aiRotator.service'
import fs from 'fs'
import path from 'path'
import { logger } from '../api/utils/logger'

export class VisionService {
  constructor() {
    // Ya no inicializamos una sola instancia, usamos el rotador industrial
  }

  /**
   * Convierte un archivo local a un objeto Part para Gemini
   */
  private fileToGenerativePart(path: string, mimeType: string) {
    return {
      inlineData: {
        data: Buffer.from(fs.readFileSync(path)).toString('base64'),
        mimeType,
      },
    }
  }

  /**
   * Analiza una captura de pantalla de un courier y extrae el estado.
   * NIVEL ÉLITE: Usa el rotador de llaves para evitar bloqueos y Visión IA.
   */
  async analyzeTrackingScreenshot(imagePath: string): Promise<{ status: string; detail: string }> {
    try {
      if (!fs.existsSync(imagePath)) {
        throw new Error('La imagen de captura no existe.')
      }

      const prompt = `
        Eres un experto en logística peruana. Analiza esta captura de pantalla de una web de seguimiento de envíos (Shalom, Olva, etc.).
        
        Tu tarea es:
        1. Identificar el estado actual del paquete.
        2. Clasificarlo OBLIGATORIAMENTE en uno de estos estados: [ENTREGADO, EN_TRANSITO, LISTO_PARA_RECOJO, PROBLEMA, NO_ENCONTRADO].
        3. Extraer un breve detalle descriptivo (ej: "Llegó a la agencia central en Lima").

        Responde ÚNICAMENTE en formato JSON con esta estructura:
        {
          "status": "ESTADO_CLASIFICADO",
          "detail": "Descripción breve"
        }
      `

      const ext = path.extname(imagePath).toLowerCase()
      let mimeType = 'image/png'
      if (ext === '.jpg' || ext === '.jpeg') mimeType = 'image/jpeg'
      else if (ext === '.webp') mimeType = 'image/webp'
      else if (ext === '.heic') mimeType = 'image/heic'
      else if (ext === '.heif') mimeType = 'image/heif'

      const imagePart = this.fileToGenerativePart(imagePath, mimeType)
      const base64Data = Buffer.from(fs.readFileSync(imagePath)).toString('base64')

      // Usar el rotador para ejecutar con reintentos y múltiples llaves
      const result = await aiRotatorService.executeWithRetry(async (model) => {
        return await model.generateContent([prompt, imagePart])
      }, 'gemini-2.0-flash', { base64: base64Data, prompt })

      const response = result.response
      const text = response.text()
      
      // Limpiar el JSON de posibles backticks de markdown
      const cleanJson = text.replace(/```json/g, '').replace(/```/g, '').trim()
      
      return JSON.parse(cleanJson)
    } catch (error: any) {
      logger.error('[VISION-AGENT] Error analizando captura:', error.message)
      return { 
        status: 'EN_TRANSITO', 
        detail: 'No se pudo analizar la imagen, se mantiene en tránsito por seguridad.' 
      }
    }
  }
}

export const visionService = new VisionService()
