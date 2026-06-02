import { Request, Response } from 'express'
import { aiService } from './service'

export class AIController {
  async chat(req: Request, res: Response) {
    try {
      const { message, history } = req.body
      if (!message) return res.status(400).json({ error: 'Mensaje requerido' })

      const response = await aiService.chat(message, history || [])
      
      // Búsqueda de productos si es necesario
      let products: any[] = []
      if (response.text.includes('[FILTER:')) {
         // Lógica simplificada para búsqueda reactiva
      }

      res.json({ success: true, ...response, products })
    } catch (error: any) {
      res.status(500).json({ error: error.message })
    }
  }

  async chatStream(req: Request, res: Response) {
    try {
      const { message, history, userId, isManagementMode, cartItems, catalogContext, requestProducts } = req.body
      const stream = await aiService.chatStream(message, history, userId, isManagementMode, cartItems, catalogContext, requestProducts)

      res.setHeader('Content-Type', 'text/event-stream')
      res.setHeader('Cache-Control', 'no-cache')
      res.setHeader('Connection', 'keep-alive')

      for await (const chunk of (stream as any)) {
        const content = chunk.choices[0]?.delta?.content || ''
        if (content) res.write(`data: ${JSON.stringify({ text: content })}\n\n`)
      }

      res.write('data: [DONE]\n\n')
      res.end()
    } catch (error: any) {
      res.status(500).json({ error: error.message })
    }
  }
}

export const aiController = new AIController()
