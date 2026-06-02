import { db } from '../database/db';
import { whatsappWebManager } from './whatsappWeb.service';
import { logger } from '../api/utils/logger';


class NotificationService {
  private workerActive = false;

  constructor() {
    // Constructor limpio
  }

  /**
   * INICIALIZACIÓN INDUSTRIAL: Se llama explícitamente al arrancar el servidor
   */
  async initInAppDB(retries = 3) {
    for (let i = 0; i < retries; i++) {
      try {
        await db.query('SELECT 1')

        await db.query(`
          CREATE TABLE IF NOT EXISTS ui_notifications (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id UUID,
            title TEXT NOT NULL,
            message TEXT NOT NULL,
            type TEXT NOT NULL,
            link TEXT,
            is_read BOOLEAN DEFAULT FALSE,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
          )
        `);

        // NUEVO: Asegurar tabla de cola de notificaciones (Resiliencia Industrial)
        await db.query(`
          CREATE TABLE IF NOT EXISTS notifications_queue (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id UUID NOT NULL,
            phone TEXT NOT NULL,
            message TEXT NOT NULL,
            media_url TEXT,
            status TEXT DEFAULT 'pending',
            attempts INTEGER DEFAULT 0,
            last_error TEXT,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
          )
        `);

        logger.info('🔔 [Notifications] Motor de Notificaciones listo.');
        return;
      } catch (e: any) {
        if (i === retries - 1) {
          logger.error('[Notifications] Error crítico en DB tras reintentos:', e.message);
        } else {
          logger.warn(`[Notifications] Reintentando conexión DB (${i + 1}/${retries})...`);
          await new Promise(r => setTimeout(r, 2000));
        }
      }
    }
  }

  /**
   * Crea una notificación visual para la campanita del panel
   */
  async notify(payload: { userId?: string, title: string, message: string, type: 'info' | 'success' | 'warning' | 'error', link?: string }) {
    try {
      const { userId, title, message, type, link } = payload;
      const { rows } = await db.query(`
        INSERT INTO ui_notifications (user_id, title, message, type, link)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING *
      `, [userId || null, title, message, type, link || null]);

      const notification = rows[0];

      // Emitir en tiempo real (lazy import para evitar dependencia circular)
      const { io } = await import('../api/server');
      if (io) {
        if (userId) {
          io.to(`user_${userId}`).emit('notification', notification);
        } else {
          io.to('admin_room').emit('notification', notification);
        }
      }

      return notification;
    } catch (error: any) {
      logger.error('Error creating UI notification:', error.message);
    }
  }

  async listUiNotifications(userId: string | null, limit = 10) {
    const { rows } = await db.query(`
      SELECT * FROM ui_notifications 
      WHERE (user_id = $1 OR (user_id IS NULL AND $2 = true))
      ORDER BY created_at DESC 
      LIMIT $3
    `, [userId, !userId, limit]);
    return rows;
  }

  async markAsRead(id: string) {
    await db.query('UPDATE ui_notifications SET is_read = true WHERE id = $1', [id]);
  }

  /**
   * Encola una notificación para ser enviada por WhatsApp.
   * La resiliencia industrial asegura que el mensaje se envíe incluso si el bot está offline momentáneamente.
   */
  async enqueue(userId: string, phone: string, message: string, mediaUrl?: string) {
    try {
      await db.query(
        `INSERT INTO notifications_queue (user_id, phone, message, media_url, status)
         VALUES ($1, $2, $3, $4, 'pending')`,
        [userId, phone, message, mediaUrl || null]
      );
      logger.info(`📧 Notificación encolada para ${phone}`);
      
      // Intentar procesar inmediatamente si no hay worker corriendo
      if (!this.workerActive) this.processQueue();
      
    } catch (error: any) {
      logger.error('Error al encolar notificación:', { error: error.message });
    }
  }

  /**
   * Procesa la cola de notificaciones pendientes con lógica de reintentos.
   */
  async processQueue() {
    if (this.workerActive) return;
    this.workerActive = true;

    try {
      // 1. Buscar notificaciones pendientes o fallidas con menos de 5 intentos
      const { rows: pending } = await db.query(
        `SELECT * FROM notifications_queue 
         WHERE status IN ('pending', 'failed') AND attempts < 5
         ORDER BY created_at ASC LIMIT 10`
      );

      for (const notification of pending) {
        try {
          // Intentar enviar
          let sendResult: any;
          if (notification.media_url) {
            sendResult = await whatsappWebManager.sendMedia(notification.user_id, notification.phone, notification.media_url, notification.message);
          } else {
            sendResult = await whatsappWebManager.sendMessage(notification.user_id, notification.phone, notification.message);
          }

          if (sendResult === false) {
            throw new Error('No LID for user or WhatsApp connection error');
          }

          // Marcar como enviada
          await db.query(
            "UPDATE notifications_queue SET status = 'sent', attempts = attempts + 1, updated_at = NOW() WHERE id = $1",
            [notification.id]
          );
          
        } catch (error: any) {
          const isPermanent = error.message.includes('Token vencido') || 
                              error.message.includes('Code 190') || 
                              error.message.includes('OAuthException') || 
                              error.message.includes('No LID');
          const nextAttempts = isPermanent ? 5 : notification.attempts + 1;
          
          if (isPermanent) {
             logger.error(`❌ Envío abortado permanentemente para ${notification.phone}: ${error.message}`);
          } else {
             logger.warn(`⚠️ Fallo en intento de envío #${notification.attempts + 1} para ${notification.phone}: ${error.message}`);
          }
          
          await db.query(
            "UPDATE notifications_queue SET status = 'failed', attempts = $1, last_error = $2, updated_at = NOW() WHERE id = $3",
            [nextAttempts, error.message, notification.id]
          );
        }
      }
    } catch (error: any) {
      logger.error('Error en el worker de notificaciones:', { error: error.message });
    } finally {
      this.workerActive = false;
      // Programar siguiente ejecución en 15 segundos
      setTimeout(() => this.processQueue(), 15000);
    }
  }
}

export const notificationService = new NotificationService();
