import { aiRotatorService } from "./aiRotator.service"
import { db } from "../database/db"
import { logger } from "../api/utils/logger"

export interface DraftProduct {
  name: string
  price: number
  description: string
  category: string
  imageUrl: string
}

export class InventoryIAService {
  /**
   * Analiza la foto de un producto y sugiere metadatos para el catálogo.
   */
  async analyzeNewProduct(base64Image: string, imageUrl: string): Promise<DraftProduct | null> {
    try {

      const prompt = `Actúa como un experto en E-commerce y Copywriting. 
      Analiza esta foto de un producto nuevo para una tienda.
      Genera:
      1. Un nombre comercial atractivo.
      2. Una descripción persuasiva corta (máximo 200 caracteres).
      3. Un precio estimado razonable en Soles Peruanos (S/).
      4. Una categoría lógica.
      
      Responde SOLO en formato JSON:
      {
        "name": "string",
        "description": "string",
        "price": number,
        "category": "string"
      }`

      const result = await aiRotatorService.executeWithRetry(async (model) => {
        return await model.generateContent([
          prompt,
          {
            inlineData: {
              data: base64Image.split(',')[1] || base64Image,
              mimeType: "image/jpeg",
            },
          },
        ])
      })

      const responseText = result.response.text()
      const data = JSON.parse(responseText.replace(/```json|```/g, ""))

      return {
        ...data,
        imageUrl
      }
    } catch (error: any) {
      logger.error("Error en InventoryIAService:", { error: error.message })
      return null
    }
  }

  /**
   * Guarda el producto definitivo en la base de datos.
   */
  async saveProduct(userId: string, draft: DraftProduct) {
    try {
      const { rows } = await db.query(
        `INSERT INTO products (user_id, name, price, description, category, images, stock)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING id`,
        [userId, draft.name, draft.price, draft.description, draft.category, [draft.imageUrl], 10] // Stock por defecto 10
      )
      return rows[0].id
    } catch (error: any) {
      logger.error("Error guardando producto desde IA:", { error: error.message })
      throw error
    }
  }
}

export const inventoryIAService = new InventoryIAService()
