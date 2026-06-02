// Servicio de Email - Backend
// Este servicio maneja el envío de emails para la aplicación

import nodemailer from 'nodemailer'
import { config } from '../config/env'

interface EmailOptions {
  to: string
  subject: string
  html: string
  text?: string
  attachments?: Array<{ filename: string; path: string }>
}

class EmailService {
  private transporter: nodemailer.Transporter | null = null

  constructor() {
    this.initializeTransporter()
  }

  private initializeTransporter() {
    const emailService = config.email.service
    const emailUser = config.email.user
    const emailPassword = config.email.password

    if (!emailUser || !emailPassword) {
      console.warn('⚠️ Email service no configurado. Las notificaciones por email no funcionarán.')
      return
    }

    try {
      this.transporter = nodemailer.createTransport({
        service: emailService,
        auth: {
          user: emailUser,
          pass: emailPassword,
        },
      })
    } catch (error) {
      console.error('Error inicializando email service:', error)
    }
  }

  async sendEmail(options: EmailOptions): Promise<boolean> {
    if (!this.transporter) {
      console.warn('Email service no disponible')
      return false
    }

    try {
      await this.transporter.sendMail({
        from: config.email.from,
        to: options.to,
        subject: options.subject,
        html: options.html,
        text: options.text || options.html.replace(/<[^>]*>/g, ''),
        attachments: options.attachments,
      })
      return true
    } catch (error) {
      console.error('Error enviando email:', error)
      return false
    }
  }

  // Plantillas de email
  async sendOrderConfirmation(order: any, customerEmail: string) {
    const isInt = order.shipping_type === 'international'
    const subject = isInt ? `🌏 [ATINES GLOBAL] Confirmación de Importación #${order.payment_reference_code || order.id.slice(0,8)}` : `✅ [ATINES] Pedido Confirmado #${order.payment_reference_code || order.id.slice(0,8)}`
    
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <style>
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #1F2937; margin: 0; padding: 0; }
          .container { max-width: 600px; margin: 0 auto; padding: 0; border: 1px solid #E5E7EB; border-radius: 16px; overflow: hidden; }
          .header { background: linear-gradient(135deg, #8B5CF6 0%, #EC4899 100%); color: white; padding: 40px 20px; text-align: center; }
          .header-global { background: linear-gradient(135deg, #1E1B4B 0%, #4F46E5 100%); color: white; padding: 40px 20px; text-align: center; }
          .content { padding: 30px; background: #ffffff; }
          .order-info { background: #F9FAFB; padding: 25px; border-radius: 12px; margin: 20px 0; border: 1px solid #F3F4F6; }
          .product-item { padding: 12px 0; border-bottom: 1px solid #E5E7EB; display: flex; justify-content: space-between; }
          .total { font-size: 24px; font-weight: 800; color: ${isInt ? '#4F46E5' : '#8B5CF6'}; margin-top: 20px; text-align: right; }
          .button { display: inline-block; padding: 14px 28px; background: ${isInt ? '#4F46E5' : '#8B5CF6'}; color: #ffffff !important; text-decoration: none; border-radius: 12px; font-weight: bold; margin: 10px 0; }
          .button-whatsapp { display: inline-block; padding: 14px 28px; background: #10B981; color: #ffffff !important; text-decoration: none; border-radius: 12px; font-weight: bold; margin: 10px 0; }
          .info-box { background: ${isInt ? '#EEF2FF' : '#F5F3FF'}; border-left: 4px solid ${isInt ? '#4F46E5' : '#8B5CF6'}; padding: 20px; margin: 20px 0; border-radius: 8px; font-size: 14px; }
          .timeline { display: flex; justify-content: space-between; margin: 30px 0; padding: 20px 0; border-top: 1px solid #EEE; border-bottom: 1px solid #EEE; text-align: center; }
          .timeline-step { flex: 1; font-size: 10px; font-weight: bold; color: #9CA3AF; text-transform: uppercase; }
          .timeline-active { color: ${isInt ? '#4F46E5' : '#8B5CF6'}; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="${isInt ? 'header-global' : 'header'}">
            <h1 style="margin:0; font-size: 28px; letter-spacing: -1px;">${isInt ? '¡IMPORTACIÓN GLOBAL!' : '¡PEDIDO CONFIRMADO!'}</h1>
            <p style="opacity: 0.9; margin-top: 10px;">Referencia: #${order.payment_reference_code || order.id.slice(0,8)}</p>
          </div>
          <div class="content">
            <h2 style="margin-top: 0;">¡Hola ${order.customer_name || 'Cliente'}!</h2>
            <p>Gracias por elegir Atines. Tu solicitud ha sido procesada correctamente y el stock ha sido reservado.</p>
            
            ${isInt ? `
              <div class="timeline">
                <div class="timeline-step timeline-active">✈️<br>Origen</div>
                <div class="timeline-step">📦<br>Aduanas</div>
                <div class="timeline-step">✈️<br>Vuelo</div>
                <div class="timeline-step">🏠<br>Destino</div>
              </div>
              <div class="info-box">
                <strong style="color: #1E1B4B;">🌏 Logística Internacional Garantizada:</strong><br>
                Tu pedido es una <strong>Importación Directa</strong>. El tiempo de entrega estimado es de <strong>10 a 20 días hábiles</strong>.<br><br>
                ✅ <strong>DNI/ID Registrado:</strong> ${order.customer_id_number || 'Pendiente'}<br>
                ✅ <strong>Costos:</strong> Todos los trámites de aduana están incluidos.
              </div>
            ` : `
              <div class="info-box">
                <strong style="color: #4C1D95;">🏠 Despacho Nacional:</strong><br>
                Tu pedido se encuentra en nuestro almacén local y será despachado vía <strong>${order.shipping_address?.includes('SHALOM') ? 'Shalom' : 'Olva Courier'}</strong> lo antes posible.
              </div>
            `}

            <div class="order-info">
              <h3 style="margin-top: 0; border-bottom: 2px solid #EEE; padding-bottom: 10px;">Resumen de Orden</h3>
              <p><strong>Estado:</strong> <span style="background: #E5E7EB; padding: 2px 8px; border-radius: 4px; font-size: 12px;">${order.status.toUpperCase()}</span></p>
              <p><strong>Envío:</strong> ${order.shipping_address}</p>
              
              <div style="margin-top: 20px;">
                ${order.products?.map((p: any) => `
                  <div class="product-item">
                    <span>${p.quantity}x ${p.name}</span>
                    <span style="font-weight: bold;">S/ ${(p.price * p.quantity).toFixed(2)}</span>
                  </div>
                `).join('') || ''}
              </div>
              
              <div class="total">
                Total: S/ ${Number(order.total).toFixed(2)}
              </div>
            </div>
            
            <div style="text-align: center; margin: 40px 0; border-top: 1px solid #EEE; padding-top: 30px;">
              <p style="font-weight: bold; margin-bottom: 20px;">Gestiona tu pedido desde aquí:</p>
              <a href="${config.server.frontendUrl}/track/${order.id}" class="button">Ver Seguimiento Visual</a>
              <br>
              <a href="https://wa.me/51989353316?text=Hola,%20necesito%20soporte%20con%20mi%20pedido%20${order.payment_reference_code || order.id}" class="button-whatsapp">Hablar con un Experto</a>
            </div>
            
            <p style="font-size: 12px; color: #9CA3AF; text-align: center; margin-top: 40px;">
              Este es un correo automático. Por favor no respondas directamente.<br>
              Atines Enterprise © 2026 - Piensa en Grande.
            </p>
          </div>
        </div>
      </body>
      </html>
    `

    return this.sendEmail({
      to: customerEmail,
      subject,
      html,
    })
  }

  async sendOrderNotificationToProvider(order: any, providerEmail: string) {
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #10B981 0%, #059669 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; }
          .alert { background: #FEF3C7; border-left: 4px solid #F59E0B; padding: 15px; margin: 20px 0; border-radius: 4px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Nuevo Pedido Recibido</h1>
          </div>
          <div class="content">
            <p>Has recibido un nuevo pedido:</p>
            
            <div class="alert">
              <strong>Pedido #${order.id}</strong><br>
              Cliente: ${order.customer_name}<br>
              Total: S/ ${order.total.toFixed(2)}<br>
              Método de pago: ${order.payment_method}
              ${order.payment_status === 'pending' ? '<br><strong style="color: #DC2626;">⚠️ Pago Pendiente</strong>' : ''}
            </div>
            
            <p>Por favor, revisa el pedido en tu panel de proveedor.</p>
          </div>
        </div>
      </body>
      </html>
    `

    return this.sendEmail({
      to: providerEmail,
      subject: `Nuevo Pedido #${order.id}`,
      html,
    })
  }

  async sendPasswordReset(email: string, resetToken: string) {
    const resetUrl = `${config.server.frontendUrl}/reset-password?token=${resetToken}`
    
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .button { display: inline-block; padding: 12px 24px; background: #8B5CF6; color: white; text-decoration: none; border-radius: 6px; margin: 20px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <h2>Recuperación de Contraseña</h2>
          <p>Has solicitado restablecer tu contraseña.</p>
          <p>Haz clic en el siguiente enlace para crear una nueva contraseña:</p>
          <a href="${resetUrl}" class="button">Restablecer Contraseña</a>
          <p>Este enlace expirará en 1 hora.</p>
          <p>Si no solicitaste este cambio, ignora este email.</p>
        </div>
      </body>
      </html>
    `

    return this.sendEmail({
      to: email,
      subject: 'Recuperación de Contraseña',
      html,
    })
  }
}

export const emailService = new EmailService()

