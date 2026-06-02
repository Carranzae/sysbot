import { db } from '../database/db'
import { logger } from '../api/utils/logger'
import { notificationService } from './notification.service'
import { conversationStateService } from './conversationState.service'

class NpsService {
  constructor() {
    // Inicializar base de datos de NPS en segundo plano
    this.initDatabase().catch(err => {
      logger.error('❌ [NPS] Error inicializando base de datos:', err.message)
    })
  }

  async initDatabase() {
    await db.query(`
      CREATE TABLE IF NOT EXISTS nps_surveys (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        order_id UUID,
        user_id UUID,
        customer_phone TEXT NOT NULL,
        score INTEGER,
        comment TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `)
    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_nps_surveys_user_id ON nps_surveys(user_id);
      CREATE INDEX IF NOT EXISTS idx_nps_surveys_order_id ON nps_surveys(order_id);
    `)
    logger.info('📊 [NPS] Tabla nps_surveys e índices listos en la base de datos.')
  }

  /**
   * Dispara una encuesta de satisfacción NPS al cliente tras la entrega de su pedido.
   */
  async triggerSurvey(order: any) {
    try {
      const name = order.customer_name?.split(' ')[0] || 'Cliente'
      const ref = order.payment_reference_code || order.id.slice(0, 8).toUpperCase()

      // Obtener el nombre del proveedor
      const { rows: provider } = await db.query('SELECT name FROM users WHERE id = $1', [order.user_id])
      const providerName = provider[0]?.name || 'nuestra tienda'

      logger.info(`📊 [NPS] Generando encuesta automática para pedido #${ref} del cliente ${order.customer_phone}`)

      // Registrar encuesta pendiente en base de datos
      const { rows: surveyRows } = await db.query(`
        INSERT INTO nps_surveys (order_id, user_id, customer_phone)
        VALUES ($1, $2, $3)
        RETURNING id
      `, [order.id, order.user_id, order.customer_phone])
      
      const surveyId = surveyRows[0].id

      // Cambiar el estado de la conversación para indicar que estamos esperando calificación NPS
      await conversationStateService.set(order.user_id, order.customer_phone, {
        npsPending: true,
        npsSurveyId: surveyId
      } as any)

      const surveyMessage = 
        `✨ *¡Hola, ${name}!* Tu pedido *#${ref}* ya ha sido entregado con éxito. 🎉\n\n` +
        `En *${providerName}*, tu satisfacción es nuestra máxima prioridad. Nos encantaría saber qué tal fue tu experiencia de compra con nosotros.\n\n` +
        `🤖 *¿Qué tan probable es que nos recomiendes con un amigo o familiar?*\n` +
        `Responde únicamente con un número del *0 al 10* (donde 0 es "nada probable" y 10 es "altamente probable").\n\n` +
        `¡Muchas gracias por tu confianza y feedback! 🌟`

      await notificationService.enqueue(order.user_id, order.customer_phone, surveyMessage)

    } catch (error: any) {
      logger.error('❌ [NPS] Error al disparar encuesta NPS:', error.message)
    }
  }

  /**
   * Intenta procesar un mensaje del cliente si corresponde a una encuesta NPS pendiente.
   * Devuelve un mensaje de respuesta si es procesado, o null si no lo es.
   */
  async handleNpsInput(userId: string, phone: string, text: string, sessionState: any): Promise<string | null> {
    try {
      const cleanText = text.trim()
      
      // 1. Si está esperando calificación numérica
      if (sessionState.npsPending && !sessionState.npsRated) {
        const score = parseInt(cleanText)
        
        if (!isNaN(score) && score >= 0 && score <= 10) {
          const surveyId = sessionState.npsSurveyId

          // Guardar el score en base de datos
          await db.query(`
            UPDATE nps_surveys 
            SET score = $1, updated_at = NOW() 
            WHERE id = $2
          `, [score, surveyId])

          // Cambiar estado a calificado y esperar comentario opcional
          await conversationStateService.set(userId, phone, {
            npsRated: true,
            npsScore: score
          } as any)

          if (score >= 9) {
            // Detener el flujo NPS (Promotor)
            await conversationStateService.set(userId, phone, {
              npsPending: false,
              npsRated: false,
              npsSurveyId: null,
              npsScore: null
            } as any)
            
            return `¡Muchísimas gracias por tu increíble calificación de *${score}/10*! 🌟 Nos alegra enormemente saber que tuviste una excelente experiencia. ¡Seguiremos trabajando con el mismo cariño y dedicación para darte siempre lo mejor! 🚀`
          } 
          
          if (score >= 7) {
            // Detener el flujo NPS (Pasivo)
            await conversationStateService.set(userId, phone, {
              npsPending: false,
              npsRated: false,
              npsSurveyId: null,
              npsScore: null
            } as any)

            return `¡Muchas gracias por tu calificación de *${score}/10*! 👍 Agradecemos enormemente tu feedback y seguiremos esforzándonos al máximo para que tu próxima experiencia de compra sea excelente.`
          }

          // Detractor (0-6): Solicitar comentario detallado
          return `Agradecemos sinceramente tu calificación honesta de *${score}/10*. Lamento mucho que tu experiencia de compra no haya sido perfecta. 😔\n\n¿Podrías contarnos brevemente qué falló o qué podríamos mejorar? Tu opinión es sumamente valiosa para nosotros y nos ayuda a corregir cualquier problema de inmediato.`
        } else {
          // El cliente envió algo que no es un número del 0 al 10
          return `Por favor, ayúdanos respondiendo únicamente con un número del *0 al 10* para calificar tu experiencia.`
        }
      }

      // 2. Si ya calificó (0-6) y está enviando el comentario explicativo
      if (sessionState.npsPending && sessionState.npsRated) {
        const surveyId = sessionState.npsSurveyId

        // Guardar comentario en base de datos
        await db.query(`
          UPDATE nps_surveys 
          SET comment = $1, updated_at = NOW() 
          WHERE id = $2
        `, [cleanText, surveyId])

        // Limpiar estado NPS de la sesión
        await conversationStateService.set(userId, phone, {
          npsPending: false,
          npsRated: false,
          npsSurveyId: null,
          npsScore: null
        } as any)

        return `Entendido. He registrado tu comentario detallado. Muchas gracias por ayudarnos a mejorar. Nuestro equipo de soporte revisará tu caso personalmente para evitar que vuelva a ocurrir. ¡Que tengas un excelente día! 🌸`
      }

      return null
    } catch (error: any) {
      logger.error('❌ [NPS] Error procesando input NPS:', error.message)
      return null
    }
  }
}

export const npsService = new NpsService()
