import { db } from '../../../database/db'
import bcrypt from 'bcryptjs'
import { encryption } from '../../../api/utils/encryption'
import fs from 'fs'
import path from 'path'

export class UserService {
  async listUsers(options: { role?: string; page?: number; limit?: number; search?: string }) {
    const { role, page = 1, limit = 20, search } = options
    const offset = (page - 1) * limit
    const params: any[] = []
    let whereClauses: string[] = []

    if (role && role !== 'all') {
      params.push(role)
      whereClauses.push(`role = $${params.length}`)
    }

    if (search) {
      params.push(`%${search.toLowerCase()}%`)
      whereClauses.push(`(LOWER(name) LIKE $${params.length} OR LOWER(email) LIKE $${params.length} OR phone LIKE $${params.length})`)
    }

    const whereStr = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : ''

    // 1. Obtener total para paginación
    const countQuery = `SELECT COUNT(*) FROM users ${whereStr}`
    const { rows: countResult } = await db.query(countQuery, params)
    const total = parseInt(countResult[0].count)

    // 2. Obtener registros paginados
    // Auditoría: Se excluyen campos sensibles (password_hash, agency_credentials, secure_config)
    let query = `
      SELECT id, name, email, phone, role, payment_gateway, logo_url, created_at, is_active,
             commission_rate, commission_mode, balance
      FROM users 
      ${whereStr}
      ORDER BY created_at DESC
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `
    const finalParams = [...params, limit, offset]
    const { rows: users } = await db.query(query, finalParams)

    return {
      users,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    }
  }

  async updateUser(id: string, data: any, isAdmin: boolean) {
    const updates: string[] = []
    const values: any[] = []
    let idx = 1

    if (data.name) { updates.push(`name = $${idx++}`); values.push(data.name.trim()) }
    if (data.email) {
      const normalizedEmail = data.email.trim().toLowerCase()
      const { rowCount } = await db.query('SELECT 1 FROM users WHERE email = $1 AND id <> $2', [normalizedEmail, id])
      if (rowCount) throw new Error('El email ya está registrado')
      updates.push(`email = $${idx++}`); values.push(normalizedEmail)
    }
    if (data.phone !== undefined) { updates.push(`phone = $${idx++}`); values.push(data.phone || null) }
    if (data.password) { updates.push(`password_hash = $${idx++}`); values.push(bcrypt.hashSync(data.password, 10)) }
    
    // Configuración de pagos y logística (Ahora con encriptación industrial)
    if (data.payment_gateway !== undefined) { updates.push(`payment_gateway = $${idx++}`); values.push(data.payment_gateway) }
    if (data.payment_config !== undefined) { 
      updates.push(`payment_config = $${idx++}`)
      // PROCESAMIENTO INDUSTRIAL: Convertir Base64 a archivos físicos con nombres legibles
      const processedConfig = await this.processConfigImages(id, data.payment_config, data.name)
      values.push(this.encryptSensitiveFields(processedConfig)) 
    }
    if (data.logistics_config !== undefined) { 
      updates.push(`logistics_config = $${idx++}`)
      values.push(this.encryptSensitiveFields(data.logistics_config)) 
    }
    
    // Branding
    if (data.logo_url !== undefined) { updates.push(`logo_url = $${idx++}`); values.push(data.logo_url) }
    if (data.qr_code !== undefined) { updates.push(`qr_code = $${idx++}`); values.push(data.qr_code) }
    if (data.primary_color !== undefined) { updates.push(`primary_color = $${idx++}`); values.push(data.primary_color) }

    // Campos sensibles (encriptación)
    if (data.agency_credentials) {
      updates.push(`agency_credentials = $${idx++}`)
      values.push(this.encryptSensitiveFields(data.agency_credentials))
    }
    if (data.secure_config) {
      updates.push(`secure_config = $${idx++}`)
      values.push(this.encryptSensitiveFields(data.secure_config))
    }

    if (isAdmin && data.is_active !== undefined) { updates.push(`is_active = $${idx++}`); values.push(data.is_active) }
    if (isAdmin && data.role !== undefined) { updates.push(`role = $${idx++}`); values.push(data.role) }
    // 💰 Monetización: Comisión por Proveedor (Solo Admin)
    if (isAdmin && data.commission_rate !== undefined) { updates.push(`commission_rate = $${idx++}`); values.push(Number(data.commission_rate)) }
    if (isAdmin && data.commission_mode !== undefined) { updates.push(`commission_mode = $${idx++}`); values.push(data.commission_mode) }
    
    // WhatsApp Multi-Tenant Config
    if (data.whatsapp_config !== undefined) { 
      updates.push(`whatsapp_config = $${idx++}`)
      values.push(this.encryptSensitiveFields(data.whatsapp_config)) 
    }

    if (data.custom_agencies !== undefined) {
      updates.push(`custom_agencies = $${idx++}`)
      values.push(JSON.stringify(data.custom_agencies))
    }

    if (updates.length === 0) throw new Error('Nada que actualizar')

    updates.push(`updated_at = NOW()`)
    const query = `UPDATE users SET ${updates.join(', ')} WHERE id = $${idx} RETURNING *`
    values.push(id)
    
    const { rows } = await db.query(query, values)
    const user = rows[0]
    
    // Si el usuario actualiza su propio perfil, devolver campos desencriptados para la UI
    if (user && user.payment_config) {
      user.payment_config = this.decryptSensitiveFields(user.payment_config)
    }
    if (user && user.logistics_config) {
      user.logistics_config = this.decryptSensitiveFields(user.logistics_config)
    }
    if (user && user.agency_credentials) {
      user.agency_credentials = this.decryptSensitiveFields(user.agency_credentials)
    }
    if (user && user.whatsapp_config) {
      user.whatsapp_config = this.decryptSensitiveFields(user.whatsapp_config)
    }
    
    return this.sanitizeUser(user)
  }

  /**
   * Elimina campos que nunca deben salir del servidor
   */
  private sanitizeUser(user: any) {
    if (!user) return null
    const { password_hash, secure_config, ...safeUser } = user
    return safeUser
  }

  async getPublicBranding(id: string) {
    const { rows } = await db.query('SELECT id, name, logo_url, primary_color FROM users WHERE id = $1 AND is_active = true', [id])
    return rows[0]
  }

  async getPublicPaymentContacts(ids: string[]) {
    const { rows } = await db.query('SELECT id, name, email, payment_config, payment_gateway FROM users WHERE id = ANY($1)', [ids])
    return rows.map(u => {
      // DESENCRIPTACIÓN INDUSTRIAL: Asegurar que los datos sean legibles para el Checkout
      const config = this.decryptSensitiveFields(u.payment_config || {})
      
      return {
        providerId: u.id,
        providerName: u.name || u.email,
        whatsappNumber: config?.manual?.whatsapp_number || '',
        hasAutomaticPayment: !!u.payment_gateway,
        paymentConfig: {
          manual: {
            whatsapp_number: config?.manual?.whatsapp_number,
            yape_phone: config?.manual?.yape_phone,
            yape_qr: config?.manual?.yape_qr,
            plin_phone: config?.manual?.plin_phone,
            plin_qr: config?.manual?.plin_qr,
            bank_accounts: config?.manual?.bank_accounts || []
          },
          public_key: config?.public_key || undefined,
          qr_code: config?.qr_code || undefined
        }
      }
    })
  }

  private encryptSensitiveFields(obj: any): any {
    if (!obj || typeof obj !== 'object') return obj
    const result = Array.isArray(obj) ? [...obj] : { ...obj }
    for (const key in result) {
      const val = result[key]
      if (typeof val === 'string' && val.length > 0) {
        const k = key.toLowerCase()
        // EXCEPCIÓN: No encriptar llaves públicas (son necesarias en el frontend para los SDKs)
        if (k.includes('public_')) {
          result[key] = val
          continue
        }
        
        if (k.includes('pass') || k.includes('key') || k.includes('token') || k.includes('secret') || k.includes('pin')) {
          // Solo encriptar si no está ya encriptado (formato iv:tag:hex)
          if (!val.includes(':') || val.split(':').length !== 3) {
            result[key] = encryption.encrypt(val)
          }
        }
      } else if (typeof val === 'object' && val !== null) {
        result[key] = this.encryptSensitiveFields(val)
      }
    }
    return result
  }

  public decryptSensitiveFields(obj: any): any {
    if (!obj || typeof obj !== 'object') return obj
    const result = Array.isArray(obj) ? [...obj] : { ...obj }
    for (const key in result) {
      const val = result[key]
      if (typeof val === 'string' && val.includes(':')) {
        try {
          const decrypted = encryption.decrypt(val)
          if (decrypted !== null) result[key] = decrypted
        } catch (e) {
          // Si falla la desencriptación, mantenemos el valor original
          // Esto evita que el sistema se caiga si un campo tiene ":" pero no está encriptado
        }
      } else if (typeof val === 'object' && val !== null) {
        result[key] = this.decryptSensitiveFields(val)
      }
    }
    return result
  }

  /**
   * Escanea la configuración buscando imágenes en Base64 para guardarlas como archivos.
   * Nombra los archivos de forma legible: qr-[nombre]-[tipo].png
   */
  private async processConfigImages(userId: string, config: any, providedName?: string): Promise<any> {
    if (!config || typeof config !== 'object') return config
    const result = JSON.parse(JSON.stringify(config)) // Deep copy
    
    // Obtener el nombre del usuario para el archivo
    let name: string = providedName || ''
    if (!name) {
      const { rows } = await db.query('SELECT name FROM users WHERE id = $1', [userId])
      name = rows[0]?.name || 'proveedor'
    }
    const cleanName = name.toLowerCase().trim().replace(/[^a-z0-9]/g, '-')

    const processRecursive = async (obj: any, parentKey: string = '') => {
      for (const key in obj) {
        const val = obj[key]
        if (typeof val === 'string' && val.startsWith('data:image')) {
          // Es un Base64, guardarlo como archivo
          const type = key.replace('_qr', '').replace('_url', '')
          const fileName = `${cleanName}-${type}-${Date.now()}.png`
          const filePath = await this.saveBase64Image(val, fileName)
          if (filePath) {
            obj[key] = filePath
          }
        } else if (typeof val === 'object' && val !== null) {
          await processRecursive(val, key)
        }
      }
    }

    await processRecursive(result)
    return result
  }

  private async saveBase64Image(base64Data: string, fileName: string): Promise<string | null> {
    try {
      const uploadsDir = path.join(process.cwd(), 'uploads')
      if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true })
      }

      const base64Image = base64Data.split(';base64,').pop()
      if (!base64Image) return null

      const filePath = path.join(uploadsDir, fileName)
      fs.writeFileSync(filePath, base64Image, { encoding: 'base64' })
      
      // Devolver la URL relativa para la DB
      return `/uploads/${fileName}`
    } catch (error) {
      console.error('Error guardando imagen Base64:', error)
      return null
    }
  }

  async updateIftttConfig(id: string, data: { ifttt_key?: string; ifttt_event_name?: string }) {
    const { rows } = await db.query('SELECT payment_config FROM users WHERE id = $1', [id])
    if (rows.length === 0) throw new Error('Usuario no encontrado')
    
    const paymentConfig = rows[0].payment_config || {}
    
    if (data.ifttt_key !== undefined) {
      if (data.ifttt_key.trim()) {
        paymentConfig.ifttt_key = encryption.encrypt(data.ifttt_key.trim())
      } else {
        delete paymentConfig.ifttt_key
      }
    }
    
    if (data.ifttt_event_name !== undefined) {
      if (data.ifttt_event_name.trim()) {
        paymentConfig.ifttt_event_name = data.ifttt_event_name.trim()
      } else {
        delete paymentConfig.ifttt_event_name
      }
    }

    await db.query('UPDATE users SET payment_config = $1, updated_at = NOW() WHERE id = $2', [
      JSON.stringify(paymentConfig),
      id
    ])

    return this.decryptSensitiveFields(paymentConfig)
  }

  async deleteIftttConfig(id: string) {
    const { rows } = await db.query('SELECT payment_config FROM users WHERE id = $1', [id])
    if (rows.length === 0) throw new Error('Usuario no encontrado')
    
    const paymentConfig = rows[0].payment_config || {}
    
    delete paymentConfig.ifttt_key
    delete paymentConfig.ifttt_event_name

    await db.query('UPDATE users SET payment_config = $1, updated_at = NOW() WHERE id = $2', [
      JSON.stringify(paymentConfig),
      id
    ])

    return this.decryptSensitiveFields(paymentConfig)
  }

  
  async setSettingsPin(id: string, pin: string) {
    // Retrieve existing payment_config
    const { rows } = await db.query('SELECT payment_config FROM users WHERE id = $1', [id])
    if (rows.length === 0) throw new Error('Usuario no encontrado')
    const paymentConfig = rows[0].payment_config || {}
    // Update PIN (will be encrypted by encryptSensitiveFields later)
    paymentConfig.settings_pin = pin
    // Encrypt sensitive fields (including PIN)
    const encryptedConfig = this.encryptSensitiveFields(paymentConfig)
    await db.query('UPDATE users SET payment_config = $1, updated_at = NOW() WHERE id = $2', [JSON.stringify(encryptedConfig), id])
    return this.decryptSensitiveFields(encryptedConfig)
  }

  async optimizeDB() {
    try {
      await db.query('ANALYZE')
      return true
    } catch (error) {
      console.error('Error optimizing DB:', error)
      throw error
    }
  }
}

export const userService = new UserService();
