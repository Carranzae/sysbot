import { Request, Response } from 'express'
import { fulfillmentService } from './service'
import { logisticsService } from '../../../services/logistics.service'
import { db } from '../../../database/db'

export class FulfillmentController {
  // --- OPERADORES ---
  async getOperators(req: Request, res: Response) {
    try {
      const user = (req as any).user
      if (user.role !== 'admin_general' && user.role !== 'provider') {
        return res.status(403).json({ error: 'Solo administradores o proveedores pueden ver operadores' })
      }
      const providerId = user.role === 'admin_general' ? (req.query.provider_id as string) : user.id
      const operators = await fulfillmentService.listOperators(providerId)
      res.json({ success: true, operators })
    } catch (error: any) {
      res.status(500).json({ error: error.message })
    }
  }

  async createOperator(req: Request, res: Response) {
    try {
      const user = (req as any).user
      if (user.role !== 'admin_general' && user.role !== 'provider') {
        return res.status(403).json({ error: 'Solo administradores o proveedores pueden crear operadores' })
      }
      const providerId = user.role === 'admin_general' ? (req.body.provider_id || user.id) : user.id
      const operator = await fulfillmentService.createOperator(req.body, providerId)
      res.status(201).json({ success: true, operator })
    } catch (error: any) {
      res.status(500).json({ error: error.message })
    }
  }

  async updateOperator(req: Request, res: Response) {
    try {
      const { id } = req.params
      const user = (req as any).user
      if (user.role !== 'admin_general' && user.role !== 'provider') {
        return res.status(403).json({ error: 'No autorizado' })
      }
      const providerId = user.role === 'admin_general' ? (req.body.provider_id || user.id) : user.id
      const operator = await fulfillmentService.updateOperator(id, req.body, providerId)
      res.json({ success: true, operator })
    } catch (error: any) {
      res.status(500).json({ error: error.message })
    }
  }

  async deleteOperator(req: Request, res: Response) {
    try {
      const { id } = req.params
      const user = (req as any).user
      if (user.role !== 'admin_general' && user.role !== 'provider') {
        return res.status(403).json({ error: 'No autorizado' })
      }
      const providerId = user.role === 'admin_general' ? (req.body.provider_id || user.id) : user.id
      await fulfillmentService.deleteOperator(id, providerId)
      res.json({ success: true, message: 'Operador eliminado' })
    } catch (error: any) {
      res.status(500).json({ error: error.message })
    }
  }

  // --- PEDIDOS ---
  async getWarehouseOrders(req: Request, res: Response) {
    try {
      const user = (req as any).user
      const { page, limit, search, provider_id } = req.query
      
      // LOGICA ROBUSTA: Detectar si es global por la URL completa o por el parámetro explícito
      const fullPath = req.originalUrl || req.path
      const isGlobal = fullPath.includes('global') || req.query.shipping_type === 'international'
      
      const result = await fulfillmentService.getWarehouseOrders(user.id, user.role, {
        page: page ? parseInt(page as string) : 1,
        limit: limit ? parseInt(limit as string) : 50,
        search: search as string,
        provider_id: provider_id as string,
        shipping_type: isGlobal ? 'international' : undefined
      })
      
      res.json({ success: true, ...result })
    } catch (error: any) {
      res.status(500).json({ error: error.message })
    }
  }

  async updateStatus(req: Request, res: Response) {
    const { id } = req.params
    const user = (req as any).user

    try {
      if (user?.role === 'customer') {
        return res.status(403).json({ error: 'No autorizado para actualizar estados de cumplimiento' })
      }
      const order = await fulfillmentService.updateFulfillmentStatus(id, req.body, user?.id, user?.role)
      res.json({ success: true, order })
    } catch (error: any) {
      try {
        const fs = await import('fs');
        const logEntry = `[${new Date().toISOString()}] ❌ ERROR: ${error.message}\nOrder: ${id}\nBody: ${JSON.stringify(req.body)}\nUser: ${user?.id}\nRole: ${user?.role}\n------------------\n`;
        fs.appendFileSync('fulfillment_error.log', logEntry);
      } catch (e) {}
      
      console.error('❌ [Fulfillment Error]:', error.message)
      res.status(400).json({ error: error.message })
    }
  }

  // --- IA ---
  async scanLabel(req: Request, res: Response) {
    try {
      const { image } = req.body
      if (!image) return res.status(400).json({ error: 'Imagen requerida' })
      const data = await fulfillmentService.scanLabel(image)
      res.json({ success: true, ...data })
    } catch (error: any) {
      res.status(500).json({ error: 'Error al procesar la imagen con IA' })
    }
  }

  // --- AGENCIAS ---
  async getAgencies(req: Request, res: Response) {
    try {
      const agencies = await logisticsService.listAgencies()
      res.json({ success: true, agencies })
    } catch (error: any) {
      res.status(500).json({ error: error.message })
    }
  }

  async createAgency(req: Request, res: Response) {
    try {
      if ((req as any).user?.role !== 'admin_general') return res.status(403).json({ error: 'No autorizado' })
      const agency = await logisticsService.createAgency(req.body)
      res.status(201).json({ success: true, agency })
    } catch (error: any) {
      res.status(500).json({ error: error.message })
    }
  }

  async updateAgency(req: Request, res: Response) {
    try {
      if ((req as any).user?.role !== 'admin_general') return res.status(403).json({ error: 'No autorizado' })
      const { id } = req.params
      const agency = await logisticsService.updateAgency(id, req.body)
      res.json({ success: true, agency })
    } catch (error: any) {
      res.status(500).json({ error: error.message })
    }
  }

  async deleteAgency(req: Request, res: Response) {
    try {
      if ((req as any).user?.role !== 'admin_general') return res.status(403).json({ error: 'No autorizado' })
      const { id } = req.params
      const success = await logisticsService.deleteAgency(id)
      res.json({ success, message: success ? 'Agencia eliminada' : 'Agencia no encontrada' })
    } catch (error: any) {
      res.status(500).json({ error: error.message })
    }
  }

  // Métodos legacy/soporte para la vista de proveedor
  async getProviderOrders(req: Request, res: Response) {
     // Simplemente una variante filtrada del listado de órdenes
     res.json({ success: true, message: 'Fulfillment Provider View ready' })
  }

  /**
   * Sincroniza el estado del pedido con la agencia externa (Olva/Shalom/etc)
   */
  async syncTracking(req: Request, res: Response) {
    try {
      const { id } = req.params
      const user = (req as any).user
      
      const trackingInfo = await logisticsService.syncOrderTracking(id)
      
      if (!trackingInfo) {
        return res.json({ success: false, message: 'No se pudo obtener información de la agencia' })
      }

      res.json({ success: true, tracking: trackingInfo })
    } catch (error: any) {
      res.status(500).json({ error: error.message })
    }
  }
}

export const fulfillmentController = new FulfillmentController()
