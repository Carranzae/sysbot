import { Request, Response } from 'express'
import { webhookService } from './service'

export class WebhookController {
  async mercadoPago(req: Request, res: Response) {
    try {
      const { providerId } = req.params
      const { action, data } = req.body
      await webhookService.handleMercadoPago(providerId, action, data)
      res.status(200).send('OK')
    } catch (error: any) {
      res.status(500).send()
    }
  }

  async izipay(req: Request, res: Response) {
    try {
      const { providerId } = req.params
      await webhookService.handleIzipay(providerId, req.body)
      res.status(200).send('OK')
    } catch (error: any) {
      res.status(500).send()
    }
  }
}

export const webhookController = new WebhookController()
