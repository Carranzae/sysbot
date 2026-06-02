import { aiRotatorService } from "./aiRotator.service"
import { db } from "../database/db"
import { logger } from "../api/utils/logger"

export class VisualSearchService {
  /**
   * Identifica un producto en una imagen y busca coincidencias en el catálogo.
   */
  async searchByImage(base64Image: string, userId: string) {
    try {

      // 1. Identificar el producto usando Visión
      const prompt = `Analiza esta imagen de un producto. 
      Identifica qué es (ej: zapatillas, polo, reloj) y extrae 3 palabras clave descriptivas (color, estilo, marca si se ve).
      Responde SOLO en formato JSON:
      {
        "product_type": "string",
        "keywords": ["word1", "word2", "word3"],
        "is_product": boolean
      }`

      const cleanBase64 = base64Image.split(',')[1] || base64Image

      const result = await aiRotatorService.executeWithRetry(async (model) => {
        return await model.generateContent([
          prompt,
          {
            inlineData: {
              data: cleanBase64,
              mimeType: "image/jpeg",
            },
          },
        ])
      }, 'gemini-2.0-flash', { base64: cleanBase64, prompt })

      const responseText = result.response.text()
      const analysis = JSON.parse(responseText.replace(/```json|```/g, ""))

      if (!analysis.is_product) {
        return { success: false, message: "No logré identificar un producto comercial en esta imagen." }
      }

      // 2. Buscar en la base de datos por similitud de palabras clave
      // Usamos una búsqueda simple por ILIKE combinando las palabras clave
      const searchTerms = analysis.keywords.join(' ')
      const { rows: matches } = await db.query(
        `SELECT id, name, price, description, images, catalog_type, lead_time_days 
         FROM products 
         WHERE user_id = $1 
           AND stock > 0 
           AND (name ILIKE $2 OR description ILIKE $2 OR name ILIKE $3 OR name ILIKE $4)
         ORDER BY stock DESC LIMIT 3`,
        [userId, `%${analysis.product_type}%`, `%${analysis.keywords[0]}%`, `%${analysis.keywords[1]}%`]
      )

      if (matches.length === 0) {
        // FALLBACK: Si no hay match visual, sugerir los más vendidos
        const { rows: topProducts } = await db.query(
          `SELECT id, name, price, images FROM products 
           WHERE user_id = $1 AND stock > 0 
           ORDER BY created_at DESC LIMIT 2`,
          [userId]
        )
        
        return { 
          success: true, // Cambiamos a true porque vamos a dar una opción
          message: `No tengo algo idéntico a esa imagen ahora mismo, pero estos son nuestros favoritos del momento que te podrían gustar:`,
          matches: topProducts,
          analysis 
        }
      }

      return { 
        success: true, 
        message: `¡Qué buen gusto! He encontrado estos productos que coinciden con tu imagen:`,
        matches,
        analysis
      }
    } catch (error: any) {
      logger.error("Error en VisualSearchService:", { error: error.message })
      return { success: false, error: "Error procesando búsqueda visual" }
    }
  }
}

export const visualSearchService = new VisualSearchService()
