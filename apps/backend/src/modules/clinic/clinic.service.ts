import { Injectable, Logger, BadRequestException, NotFoundException, Inject, forwardRef } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { AppointmentsService } from '../appointments/appointments.service';
import { Cron, CronExpression } from '@nestjs/schedule';
import { WhatsappWebService } from '../whatsapp/whatsapp-web.service';
import { WhatsappService } from '../whatsapp/whatsapp.service';
import axios from 'axios';

@Injectable()
export class ClinicService {
  private readonly logger = new Logger(ClinicService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly appointmentsService: AppointmentsService,
    private readonly whatsappWebService: WhatsappWebService,
    private readonly whatsappService: WhatsappService,
  ) {}

  /**
   * 1. Integración EHR/HIS: Recibe una cita médica del software de la clínica
   */
  async createAppointmentFromIntegration(businessId: string, data: any) {
    this.logger.log(`[Clinic Integration] Nueva cita recibida para el negocio ${businessId}`);
    
    // Validar datos básicos
    if (!data.customerPhone || !data.appointmentDate || !data.customerName) {
      throw new BadRequestException('Faltan datos obligatorios para registrar la cita (customerPhone, customerName, appointmentDate).');
    }

    // Buscar o crear el contacto
    let contact = await this.prisma.contact.findFirst({
      where: { phone: data.customerPhone, businessId }
    });

    if (!contact) {
      contact = await this.prisma.contact.create({
        data: {
          phone: data.customerPhone,
          businessId,
          name: data.customerName,
          source: 'CRM',
          autoCreated: true,
          metadata: {
            ehrHistory: [{
              action: 'Expediente clínico iniciado vía integración HIS',
              updatedAt: new Date()
            }]
          }
        }
      });
    }

    // Registrar la cita a través del servicio
    const appointment = await this.appointmentsService.create(businessId, {
      customerName: data.customerName,
      customerPhone: data.customerPhone,
      customerEmail: data.customerEmail || null,
      appointmentDate: new Date(data.appointmentDate),
      duration: data.duration || 60,
      notes: data.notes || 'Registrada por integración externa',
      specialty: data.specialty || 'General',
      specialist: data.specialist || 'Médico de Turno',
      status: 'PENDING',
      origin: 'BOT'
    });

    // Registrar en el expediente del paciente
    await this.appointmentsService.syncWithEHR(businessId, data.customerPhone, appointment.id, 'PENDING');

    return appointment;
  }

  /**
   * 2. Automatización: Envío de recordatorios 24 horas antes de la cita
   */
  @Cron(CronExpression.EVERY_HOUR)
  async checkAndSendAppointmentReminders() {
    this.logger.log('[Clinic Service] Iniciando cron de recordatorios de citas 24h...');
    
    const now = new Date();
    const rangeStart = new Date(now.getTime() + 23 * 60 * 60 * 1000); // 23h en el futuro
    const rangeEnd = new Date(now.getTime() + 25 * 60 * 60 * 1000);   // 25h en el futuro

    // Buscar todas las citas pendientes en ese rango
    const upcomingAppointments = await this.prisma.appointment.findMany({
      where: {
        appointmentDate: {
          gte: rangeStart,
          lte: rangeEnd
        },
        status: 'PENDING',
        reminderSent: false
      },
      include: {
        business: true
      }
    });

    this.logger.log(`[Clinic Service] Encontradas ${upcomingAppointments.length} citas médicas que requieren recordatorio.`);

    for (const apt of upcomingAppointments) {
      if (apt.business.industryType !== 'CLINIC') {
        continue;
      }

      try {
        const formattedTime = apt.appointmentDate.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
        const reminderContent = `Hola ${apt.customerName}, confirma tu cita médica de mañana a las ${formattedTime}: responde *CONFIRMAR* o *CANCELAR*.`;

        // Intentar enviar realmente por WhatsApp
        let messageSent = false;
        let platformUsed: 'WHATSAPP_WEB' | 'WHATSAPP_API' = 'WHATSAPP_WEB';
        try {
          // Buscar botConfig para ver qué canal está habilitado
          const botConfig = await this.prisma.botConfig.findUnique({
            where: { businessId: apt.businessId },
            select: { whatsappWebEnabled: true, whatsappApiEnabled: true, whatsappMode: true },
          });

          const mode = botConfig?.whatsappMode || 'WHATSAPP_WEB';

          if (mode === 'WHATSAPP_WEB' && (botConfig?.whatsappWebEnabled !== false)) {
            platformUsed = 'WHATSAPP_WEB';
            const toJid = apt.customerPhone.includes('@') ? apt.customerPhone : `${apt.customerPhone}@s.whatsapp.net`;
            this.logger.log(`[Clinic Service] Enviando recordatorio vía WhatsApp Web a ${toJid}`);
            await this.whatsappWebService.sendMessage(apt.businessId, toJid, reminderContent);
            messageSent = true;
          } else if (mode === 'WHATSAPP_API' && (botConfig?.whatsappApiEnabled !== false)) {
            platformUsed = 'WHATSAPP_API';
            const account = await this.prisma.whatsAppAccount.findFirst({
              where: { businessId: apt.businessId, isActive: true }
            });
            if (account) {
              this.logger.log(`[Clinic Service] Enviando recordatorio vía WhatsApp API a ${apt.customerPhone} usando PhoneId ${account.phoneNumberId}`);
              await this.whatsappService.sendMessage(account.phoneNumberId, apt.customerPhone, reminderContent);
              messageSent = true;
            } else {
              this.logger.warn(`[Clinic Service] No se encontró cuenta de WhatsApp API activa para businessId: ${apt.businessId}`);
            }
          }
        } catch (sendErr: any) {
          this.logger.warn(`[Clinic Service] Error enviando por WhatsApp: ${sendErr.message}. Se registrará igualmente como PENDING.`);
        }

        // Registrar el recordatorio en el historial de chat
        await this.prisma.message.create({
          data: {
            businessId: apt.businessId,
            direction: 'OUTBOUND',
            content: reminderContent,
            from: '',
            to: apt.customerPhone,
            platform: platformUsed,
            status: messageSent ? 'SENT' : 'PENDING'
          }
        });

        // Actualizar el estado en la cita
        await this.prisma.appointment.update({
          where: { id: apt.id },
          data: { reminderSent: true }
        });

        this.logger.log(`[Clinic Service] Recordatorio ${messageSent ? 'enviado' : 'registrado (pendiente de envío)'} para ${apt.customerPhone}`);
      } catch (err: any) {
        this.logger.error(`Error enviando recordatorio para cita ${apt.id}: ${err.message}`);
      }
    }
  }

  /**
   * 3. Portal Self-Service: Obtener resultados de laboratorio o recetas médicas en PDF
   */
  async getPatientDocuments(businessId: string, customerPhone: string) {
    // Buscar archivos (DOCUMENT) del negocio que coincidan con la descripción o etiquetas del paciente
    const patientFiles = await this.prisma.file.findMany({
      where: {
        businessId,
        fileType: 'DOCUMENT',
        isActive: true,
        OR: [
          { tags: { has: customerPhone } },
          { originalName: { contains: customerPhone } },
          { description: { contains: customerPhone } }
        ]
      },
      orderBy: { createdAt: 'desc' }
    });

    return patientFiles.map(f => ({
      id: f.id,
      name: f.originalName,
      type: f.mimeType,
      url: f.url,
      createdAt: f.createdAt
    }));
  }

  /**
   * Notificación automática al subir un resultado de laboratorio
   */
  async notifyNewLabResult(businessId: string, fileId: string) {
    const file = await this.prisma.file.findUnique({
      where: { id: fileId }
    });

    if (!file || file.businessId !== businessId) {
      throw new NotFoundException('Archivo no encontrado.');
    }

    // Intentar extraer el teléfono del paciente del nombre o descripción del archivo
    const phoneRegex = /(?:51|)\d{9}/g;
    const phoneMatch = file.originalName.match(phoneRegex) || file.description?.match(phoneRegex);

    if (phoneMatch) {
      const patientPhone = phoneMatch[0];
      const link = `https://portal.nexorium.com/patient/documents/${file.id}`;
      const alertMsg = `Tu resultado médico está listo. Descárgalo de forma segura aquí: ${link}`;

      await this.prisma.message.create({
        data: {
          businessId,
          direction: 'OUTBOUND',
          content: alertMsg,
          from: '',
          to: patientPhone,
          platform: 'WHATSAPP_WEB',
          status: 'SENT'
        }
      });
      this.logger.log(`[Lab Sync] Notificación enviada al paciente ${patientPhone} para el archivo ${file.id}`);
    }
  }

  /**
   * 4. Liquidación y Comisiones de Médicos
   */
  async configureDoctorContract(businessId: string, data: any) {
    if (!data.medicoId) {
      throw new BadRequestException('Falta medicoId para configurar contrato.');
    }

    const percentage = data.porcentajeComision !== undefined ? parseFloat(data.porcentajeComision) : 0.0;
    const fixed = data.montoFijo !== undefined ? parseFloat(data.montoFijo) : 0.0;

    const existing = await this.prisma.medicosConfigContract.findFirst({
      where: {
        businessId,
        medicoId: data.medicoId
      }
    });

    if (existing) {
      return this.prisma.medicosConfigContract.update({
        where: { id: existing.id },
        data: {
          porcentajeComision: percentage,
          montoFijo: fixed
        }
      });
    }

    return this.prisma.medicosConfigContract.create({
      data: {
        businessId,
        medicoId: data.medicoId,
        porcentajeComision: percentage,
        montoFijo: fixed
      }
    });
  }

  async getContracts(businessId: string) {
    return this.prisma.medicosConfigContract.findMany({
      where: { businessId },
      orderBy: { createdAt: 'desc' }
    });
  }

  async getInventoryItems(businessId: string) {
    return this.prisma.medicalInventoryItem.findMany({
      where: { businessId },
      orderBy: { name: 'asc' }
    });
  }

  async getProcedureSupplies(businessId: string) {
    return this.prisma.medicalProcedureSupplies.findMany({
      where: { businessId },
      orderBy: { procedureName: 'asc' }
    });
  }

  async processInvoiceCommission(businessId: string, invoiceData: any) {
    this.logger.log(`[Commission Calculation] Procesando factura ${invoiceData.invoiceNumber} para liquidación`);

    if (!invoiceData.amount || !invoiceData.medicoId) {
      throw new BadRequestException('Faltan datos financieros requeridos (amount, medicoId).');
    }

    const rawAmount = parseFloat(invoiceData.amount);
    
    // Deducción estándar del 18% (impuestos) e insumos del 10%
    const netAmount = rawAmount * 0.72; // Monto neto deducido (72%)

    // Buscar contrato del médico
    const contract = await this.prisma.medicosConfigContract.findFirst({
      where: { businessId, medicoId: invoiceData.medicoId }
    });

    const percent = contract ? contract.porcentajeComision : 50.0; // 50% por defecto
    const fixed = contract ? contract.montoFijo : 0.0;

    const commission = (netAmount * (percent / 100)) + fixed;

    // Actualizar balance en la billetera virtual del médico
    const wallet = await this.prisma.medicoWallet.findFirst({
      where: { businessId, medicoId: invoiceData.medicoId }
    });

    let updatedWallet;
    if (wallet) {
      updatedWallet = await this.prisma.medicoWallet.update({
        where: { id: wallet.id },
        data: { balance: wallet.balance + commission }
      });
    } else {
      updatedWallet = await this.prisma.medicoWallet.create({
        data: {
          businessId,
          medicoId: invoiceData.medicoId,
          balance: commission
        }
      });
    }

    this.logger.log(`[Commission Sync] Médico ${invoiceData.medicoId} liquidado con S/ ${commission.toFixed(2)}. Balance actual: S/ ${updatedWallet.balance.toFixed(2)}`);
    return { commission, walletBalance: updatedWallet.balance };
  }

  async getDoctorPayouts(businessId: string) {
    return this.prisma.medicoWallet.findMany({
      where: { businessId },
      orderBy: { balance: 'desc' }
    });
  }

  /**
   * 5. Automatización de Inventario e Insumos Médicos
   */
  async configureProcedureSupplies(businessId: string, data: any) {
    return this.prisma.medicalProcedureSupplies.upsert({
      where: {
        businessId_procedureName_itemSku: {
          businessId,
          procedureName: data.procedureName,
          itemSku: data.itemSku
        }
      },
      update: {
        quantity: data.quantity || 1
      },
      create: {
        businessId,
        procedureName: data.procedureName,
        itemSku: data.itemSku,
        quantity: data.quantity || 1
      }
    });
  }

  async createInventoryItem(businessId: string, data: any) {
    return this.prisma.medicalInventoryItem.upsert({
      where: {
        businessId_sku: {
          businessId,
          sku: data.sku
        }
      },
      update: {
        stock: data.stock,
        minStock: data.minStock || 5
      },
      create: {
        businessId,
        name: data.name,
        sku: data.sku,
        stock: data.stock,
        minStock: data.minStock || 5
      }
    });
  }

  async deductInventoryForProcedure(businessId: string, procedureName: string) {
    this.logger.log(`[Inventory Check] Evaluando insumos para procedimiento: "${procedureName}"`);
    
    // Buscar los insumos requeridos para este procedimiento
    const supplies = await this.prisma.medicalProcedureSupplies.findMany({
      where: { businessId, procedureName: { equals: procedureName, mode: 'insensitive' } }
    });

    if (supplies.length === 0) {
      this.logger.warn(`No se encontraron insumos configurados para el procedimiento "${procedureName}"`);
      return { success: false, reason: 'Procedimiento no configurado' };
    }

    const alerts = [];
    
    for (const supply of supplies) {
      const item = await this.prisma.medicalInventoryItem.findFirst({
        where: { businessId, sku: supply.itemSku }
      });

      if (item) {
        const newStock = Math.max(0, item.stock - supply.quantity);
        
        // Actualizar stock real
        await this.prisma.medicalInventoryItem.update({
          where: { id: item.id },
          data: { stock: newStock }
        });

        this.logger.log(`[Inventory Deduct] SKU ${item.sku} descontado en ${supply.quantity} unidades. Stock restante: ${newStock}`);

        // Verificar si bajó del stock mínimo
        if (newStock <= item.minStock) {
          alerts.push({
            sku: item.sku,
            name: item.name,
            currentStock: newStock,
            minStock: item.minStock
          });
        }
      }
    }

    // Si hay alertas de desabasto, emitir correos o alertas
    if (alerts.length > 0) {
      await this.triggerProcurementAlerts(businessId, alerts);
    }

    return { success: true, deductedCount: supplies.length, alertsCount: alerts.length };
  }

  private async triggerProcurementAlerts(businessId: string, alerts: any[]) {
    this.logger.warn(`[Stock Alert] 🚨 Alerta de desabasto crítico de insumos para el negocio ${businessId}:`);
    for (const alert of alerts) {
      this.logger.warn(`  - SKU: ${alert.sku} (${alert.name}). Stock actual: ${alert.currentStock} (Mínimo: ${alert.minStock})`);
      
      // Registrar la notificación de desabastecimiento en la BD
      await this.prisma.notification.create({
        data: {
          businessId,
          type: 'GENERAL',
          recipient: 'admin',
          subject: `⚠️ Stock Crítico: ${alert.name}`,
          message: `El insumo ${alert.name} (SKU: ${alert.sku}) ha bajado a un stock de ${alert.currentStock} unidades. Se requiere reposición.`,
          isSent: false,
        }
      });
    }
  }
}
