import { db } from '../../../database/db'
import { logger } from '../../../api/utils/logger'

export interface SecurityEvent {
  type: string
  severity: string
  ip: string
  userAgent?: string
  details?: any
  location?: any
}

export class SecurityService {
  async logEvent(event: SecurityEvent) {
    try {
      const { rows } = await db.query(
        `INSERT INTO security_events (type, severity, ip, user_agent, details, location)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id`,
        [
          event.type,
          event.severity,
          event.ip,
          event.userAgent || null,
          JSON.stringify(event.details || {}),
          JSON.stringify(event.location || {})
        ]
      )
      return rows[0].id
    } catch (e: any) {
      logger.error('Error logging security event', { error: e.message })
      return null
    }
  }

  async getEvents(filters: any = {}, limit = 50, offset = 0) {
    let query = 'SELECT * FROM security_events'
    const params: any[] = []
    let idx = 1

    const whereClauses: string[] = []
    if (filters.type) {
      whereClauses.push(`type = $${idx++}`)
      params.push(filters.type)
    }
    if (filters.severity) {
      whereClauses.push(`severity = $${idx++}`)
      params.push(filters.severity)
    }

    if (whereClauses.length > 0) {
      query += ' WHERE ' + whereClauses.join(' AND ')
    }

    query += ` ORDER BY created_at DESC LIMIT $${idx++} OFFSET $${idx++}`
    params.push(limit, offset)

    const { rows } = await db.query(query, params)
    const { rows: countRows } = await db.query('SELECT COUNT(*) FROM security_events')
    
    return {
      events: rows,
      total: parseInt(countRows[0].count)
    }
  }

  async getSecurityConfig() {
    const { rows } = await db.query('SELECT value FROM site_settings WHERE id = $1', ['security_config'])
    return rows[0]?.value || {}
  }

  async updateSecurityConfig(config: any) {
    await db.query(
      'UPDATE site_settings SET value = $1, updated_at = NOW() WHERE id = $2',
      [JSON.stringify(config), 'security_config']
    )
    return config
  }
}

export const securityService = new SecurityService()
