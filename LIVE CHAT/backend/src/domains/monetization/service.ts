import { db } from '../../../database/db'
import { logger } from '../../../api/utils/logger'

export class MonetizationService {
  async getAdminStats() {
    try {
      const statsQuery = `
        SELECT 
          COALESCE(SUM(commission_amount), 0) as total_commissions,
          COUNT(*) as total_transactions,
          COALESCE(SUM(total_order_amount), 0) as total_volume
        FROM commissions_ledger
        WHERE status = 'recorded'
      `
      const { rows } = await db.query(statsQuery)
      
      const monthlyQuery = `
        SELECT 
          TO_CHAR(created_at, 'Mon') as month,
          COALESCE(SUM(commission_amount), 0) as amount
        FROM commissions_ledger
        WHERE created_at > NOW() - INTERVAL '6 months'
        GROUP BY TO_CHAR(created_at, 'Mon'), DATE_TRUNC('month', created_at)
        ORDER BY DATE_TRUNC('month', created_at)
      `
      const { rows: monthly } = await db.query(monthlyQuery)

      return {
        overall: rows[0],
        history: monthly
      }
    } catch (error: any) {
      logger.error('❌ Error obteniendo estadísticas de monetización:', { error: error.message })
      throw error
    }
  }

  async getLedger(options: { providerId?: string, limit?: number, page?: number }) {
    const { providerId, limit = 50, page = 1 } = options
    const offset = (page - 1) * limit
    
    let query = `
      SELECT l.*, u.name as provider_name, o.customer_name
      FROM commissions_ledger l
      LEFT JOIN users u ON l.provider_id = u.id
      LEFT JOIN orders o ON l.order_id = o.id
    `
    const params: any[] = []
    if (providerId) {
      params.push(providerId)
      query += ` WHERE l.provider_id = $${params.length}`
    }
    
    query += ` ORDER BY l.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`
    const { rows } = await db.query(query, [...params, limit, offset])
    
    return rows
  }
}

export const monetizationService = new MonetizationService()
