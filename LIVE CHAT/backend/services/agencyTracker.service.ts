import { encryption } from '../api/utils/encryption'
import { logger } from '../api/utils/logger'

export interface AgencyCredentials {
  user?: string
  pass?: string
}

/**
 * Servicio encargado de interactuar con las plataformas de agencias (Olva, Shalom, Marvisur, etc.)
 */
export class AgencyTrackerService {
  
  private getDecrypted(creds?: AgencyCredentials): AgencyCredentials {
    return {
      user: encryption.decrypt(creds?.user || ''),
      pass: encryption.decrypt(creds?.pass || '')
    }
  }

  /**
   * Obtiene la trayectoria de un pedido en Olva Courier
   */
  async getOlvaTrajectory(trackingNumber: string, rawCreds: AgencyCredentials) {
    const creds = this.getDecrypted(rawCreds)
    if (!creds.user || !creds.pass) return null

    try {
      logger.info(`Consultando Olva (Seguro) para: ${trackingNumber}`)
      // ... lógica de rastreo ...
      return { status: 'en_transito' }
    } catch (error) {
      return null
    }
  }

  /**
   * Obtiene la trayectoria de un pedido en Shalom
   */
  async getShalomTrajectory(trackingNumber: string, rawCreds: AgencyCredentials) {
    const creds = this.getDecrypted(rawCreds)
    if (!creds.user || !creds.pass) return null

    try {
      logger.info(`Consultando Shalom (Seguro) para: ${trackingNumber}`)
      return { status: 'agencia_destino' }
    } catch (error) {
      return null
    }
  }

  /**
   * Método genérico para futuras agencias
   */
  async getGenericTrajectory(agencyName: string, trackingNumber: string, rawCreds: AgencyCredentials) {
    const creds = this.getDecrypted(rawCreds)
    logger.info(`Rastreo genérico para ${agencyName}: ${trackingNumber}`)
    return null
  }
}

export const agencyTrackerService = new AgencyTrackerService()
