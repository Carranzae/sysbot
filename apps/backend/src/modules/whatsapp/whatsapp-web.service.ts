import { Injectable, Inject, forwardRef, OnModuleInit } from '@nestjs/common';
import { makeWASocket, DisconnectReason, useMultiFileAuthState, makeCacheableSignalKeyStore, fetchLatestBaileysVersion, CacheStore, downloadMediaMessage, Browsers } from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import NodeCache from '@cacheable/node-cache';
import { PrismaService } from '../database/prisma.service';
import { AiService } from '../ai/ai.service';
import { EvidenceService } from '../evidence/evidence.service';
import { PaymentService } from '../payment/payment.service';
import { InvoiceService } from '../invoice/invoice.service';
import { FilesService } from '../files/files.service';
import { PlanService } from '../plan/plan.service';
import { JobsService } from '../jobs/jobs.service';
import { WebhooksService } from '../webhooks/webhooks.service';
import { STTService } from '../audio/stt.service';
import { TTSService } from '../audio/tts.service';
import { rmSync, existsSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { EvidenceType } from '@prisma/client';
import { WebsocketGateway } from '../websocket/websocket.gateway';
import { SwarmOrchestratorService } from '../swarm/swarm-orchestrator.service';

@Injectable()
export class WhatsappWebService implements OnModuleInit {
  private sockets: Map<string, any> = new Map();
  private pairingCodes: Map<string, string> = new Map();
  private pendingEvidence: Map<string, { media: any; text: string; from: string }> = new Map();
  private pendingPayments: Map<string, { fileId: string; customerPhone: string; customerName?: string }> = new Map();
  private initializing: Map<string, boolean> = new Map(); // Lock para prevenir múltiples inicializaciones
  private reinitTimeouts: Map<string, NodeJS.Timeout> = new Map(); // Para evitar múltiples reinicializaciones simultáneas

  constructor(
    private prisma: PrismaService,
    @Inject(forwardRef(() => AiService))
    private aiService: AiService,
    private evidenceService: EvidenceService,
    private paymentService: PaymentService,
    private invoiceService: InvoiceService,
    private filesService: FilesService,
    private planService: PlanService,
    @Inject(forwardRef(() => JobsService))
    private jobsService: JobsService,
    private webhooksService: WebhooksService,
    private sttService: STTService,
    private ttsService: TTSService,
    private websocketGateway: WebsocketGateway,
    private swarmService: SwarmOrchestratorService,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.restoreActiveSessions();
  }

  private async restoreActiveSessions(): Promise<void> {
    try {
      const configs = await this.prisma.botConfig.findMany({
        where: {
          OR: [
            { whatsappWebEnabled: true },
            { whatsappMode: 'WHATSAPP_WEB' },
          ],
        },
        select: {
          businessId: true,
          whatsappWebEnabled: true,
          whatsappMode: true,
        },
      });

      for (const config of configs) {
        const businessId = config.businessId;
        const isEnabled = config.whatsappWebEnabled === true || config.whatsappMode === 'WHATSAPP_WEB';

        if (!isEnabled) {
          continue;
        }

        if (this.initializing.get(businessId) || this.sockets.has(businessId)) {
          continue;
        }

        try {
          await this.initializeClient(businessId);
        } catch (error) {
          console.error('Error restoring WhatsApp Web session for businessId:', businessId, error);
        }
      }
    } catch (error) {
      console.error('Error loading WhatsApp Web sessions on startup:', error);
    }
  }

  async initializeClient(businessId: string, forceInit: boolean = false): Promise<any> {
    // Verificar que WhatsApp Web esté habilitado (a menos que se fuerce la inicialización)
    const config = await this.prisma.botConfig.findUnique({
      where: { businessId },
      select: { 
        whatsappWebEnabled: true, 
        whatsappMode: true,
        whatsappWebSession: true, 
        whatsappWebNumber: true,
        business: {
          select: {
            whatsappNumber: true,
          },
        },
      },
    });

    // Solo inicializar si está explícitamente habilitado o si se fuerza la inicialización
    const isEnabled = config?.whatsappWebEnabled === true || 
                     (config?.whatsappMode === 'WHATSAPP_WEB' && config?.whatsappWebEnabled !== false) ||
                     forceInit;
    
    if (!isEnabled) {
      console.log('WhatsApp Web is not enabled for businessId:', businessId);
      // Si hay un socket activo pero está deshabilitado, cerrarlo
      if (this.sockets.has(businessId)) {
        await this.closeClient(businessId);
      }
      return null;
    }

    // Si se fuerza la inicialización y no está habilitado, habilitarlo automáticamente
    if (forceInit && (!config || !config?.whatsappWebEnabled)) {
      if (!config) {
        // Crear botConfig si no existe
        console.log('Creating botConfig for businessId:', businessId);
        await this.prisma.botConfig.create({
          data: {
            businessId,
            whatsappWebEnabled: true,
            welcomeMessage: '¡Hola! 👋 Bienvenido a nuestro negocio. ¿En qué podemos ayudarte?',
            fallbackMessage: 'En este momento no estamos disponibles. Te responderemos pronto.',
            autoReply: true, // Habilitar respuestas automáticas
            audioEnabled: false,
            aiProvider: 'OPENAI',
            aiModel: 'gpt-4o',
          }
        });
      } else {
        // Actualizar botConfig existente
        await this.prisma.botConfig.update({
          where: { businessId },
          data: { whatsappWebEnabled: true } as any,
        });
      }
      console.log('WhatsApp Web enabled automatically for businessId:', businessId);
    }

    // Prevenir múltiples inicializaciones simultáneas
    if (this.initializing.get(businessId)) {
      console.log('⚠️ Initialization already in progress for businessId:', businessId, '- Skipping duplicate initialization');
      return null; // Retornar null en lugar de undefined para ser más explícito
    }
    
    // Cancelar cualquier reinicialización pendiente antes de iniciar una nueva
    if (this.reinitTimeouts && this.reinitTimeouts.has(businessId)) {
      console.log('⚠️ Cancelling pending reinitialization for businessId:', businessId);
      clearTimeout(this.reinitTimeouts.get(businessId));
      this.reinitTimeouts.delete(businessId);
    }
    
    this.initializing.set(businessId, true);
    console.log('🔒 Lock acquired for initialization of businessId:', businessId);
    
    try {
      // Si ya existe un socket, cerrarlo primero antes de crear uno nuevo
      if (this.sockets.has(businessId)) {
        const existingSock = this.sockets.get(businessId);
        try {
          if (existingSock && !existingSock.user) {
            console.log('Closing existing socket before reinitializing...');
            await existingSock.end(undefined);
          }
        } catch (error) {
          console.error('Error closing existing socket:', error);
        }
        this.sockets.delete(businessId);
      }

    let phoneNumber = config?.whatsappWebNumber || config?.business?.whatsappNumber;
    if (!phoneNumber) {
      const business = await this.prisma.business.findUnique({
        where: { id: businessId },
        select: { whatsappNumber: true },
      });
      phoneNumber = business?.whatsappNumber || '';

      if (phoneNumber) {
        await this.prisma.botConfig.upsert({
          where: { businessId },
          update: { whatsappWebNumber: phoneNumber },
          create: {
            businessId,
            whatsappWebNumber: phoneNumber,
            whatsappWebEnabled: true,
            whatsappMode: 'WHATSAPP_WEB',
            welcomeMessage: 'Hola! Bienvenido a nuestro negocio. En que podemos ayudarte?',
            fallbackMessage: 'En este momento no estamos disponibles. Te responderemos pronto.',
            autoReply: true,
            audioEnabled: false,
            aiProvider: 'OPENAI',
            aiModel: 'gpt-4o',
          },
        });
      }
    }
    if (!phoneNumber) {
      console.warn(`[WhatsApp Web] ⚠️ No phone number configured for businessId: ${businessId}. Skipping client initialization.`);
      if (forceInit) {
        throw new Error('Phone number not configured for WhatsApp Web. Go to Settings → WhatsApp Web and configure your phone number.');
      }
      return null;
    }

    const sessionsDir = join(process.cwd(), 'whatsapp_auth_sessions');
    if (!existsSync(sessionsDir)) {
      const fs = require('fs');
      fs.mkdirSync(sessionsDir, { recursive: true });
    }
    const authDir = join(sessionsDir, businessId);
    const { state, saveCreds } = await useMultiFileAuthState(authDir);
    const { version } = await fetchLatestBaileysVersion();

    const msgRetryCounterCache = new NodeCache() as CacheStore;

    const sock = makeWASocket({
      version,
      browser: ['Ubuntu', 'Chrome', '20.0.04'],
      markOnlineOnConnect: false,
      syncFullHistory: false,
      auth: {
        creds: state.creds,
        keys: makeCacheableSignalKeyStore(state.keys, undefined as any),
      },
      msgRetryCounterCache,
      generateHighQualityLinkPreview: false,
    });

    this.sockets.set(businessId, sock);
    this.initializing.set(businessId, false); // Liberar el lock después de crear el socket

    // Request pairing code if not registered
    if (!sock.authState.creds.registered) {
      // For web, wait for QR instead of requesting pairing code
    }

    (sock.ev as any).on('qr', async (qr) => {
      console.log('QR generated for business', businessId, ':', qr);
      this.storePairingCode(businessId, qr as string);
    });

    sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr, isNewLogin } = update;
      
      // Capturar QR del evento connection.update
      if (qr) {
        console.log('QR generated for business', businessId, ':', qr);
        await this.storePairingCode(businessId, qr as string);
        this.updateStatus(businessId, 'QR_READY');
        // Habilitar WhatsApp Web automáticamente cuando se genera el QR
        try {
          const currentConfig = await this.prisma.botConfig.findUnique({
            where: { businessId },
            select: { whatsappWebEnabled: true },
          });
          if (!currentConfig?.whatsappWebEnabled) {
            await this.prisma.botConfig.update({
              where: { businessId },
              data: { whatsappWebEnabled: true } as any,
            });
            console.log('WhatsApp Web enabled automatically when QR was generated for businessId:', businessId);
          }
        } catch (error) {
          console.error('Error enabling WhatsApp Web when QR generated:', error);
        }
      }
      
      // Manejar login exitoso - necesita reiniciar conexión
      if (isNewLogin) {
        console.log('New login detected, closing old socket and reinitializing...');
        this.updateStatus(businessId, 'PAIRING_SUCCESS');
        // Habilitar WhatsApp Web automáticamente después del pairing exitoso
        try {
          await this.prisma.botConfig.update({
            where: { businessId },
            data: { whatsappWebEnabled: true } as any,
          });
          console.log('WhatsApp Web enabled automatically after successful pairing for businessId:', businessId);
        } catch (error) {
          console.error('Error enabling WhatsApp Web after pairing:', error);
        }
        // Cerrar el socket actual
        if (this.sockets.has(businessId)) {
          const existingSock = this.sockets.get(businessId);
          try {
            if (existingSock) {
              await existingSock.end(undefined);
            }
          } catch (error) {
            console.error('Error closing socket after new login:', error);
          }
        }
        this.sockets.delete(businessId);
        this.initializing.set(businessId, false); // Liberar el lock
        // Reiniciar después de un delay más largo para evitar conflictos
        // Usar un delay único para evitar múltiples llamadas simultáneas
        if (this.reinitTimeouts && this.reinitTimeouts.has(businessId)) {
          clearTimeout(this.reinitTimeouts.get(businessId));
        }
        if (!this.reinitTimeouts) {
          this.reinitTimeouts = new Map();
        }
        const timeoutId = setTimeout(() => {
          console.log('Reinitializing after successful pairing...');
          this.reinitTimeouts?.delete(businessId);
          this.initializeClient(businessId, true); // forceInit = true para asegurar inicialización
        }, 3000); // Aumentar delay a 3 segundos
        this.reinitTimeouts.set(businessId, timeoutId);
        return;
      }
      
      if (connection === 'close') {
        const statusCode = (lastDisconnect?.error as Boom)?.output?.statusCode;
        const errorMessage = (lastDisconnect?.error as any)?.message || '';
        
        console.log('Connection closed with status:', statusCode, 'Error:', errorMessage);
        
        // Verificar si hay un QR pendiente (usuario esperando escanear)
        const hasPendingQR = this.pairingCodes.has(businessId);
        
        // Si hay un QR pendiente y el cierre es normal (sin error específico), NO reconectar
        // Esto permite que el usuario tenga tiempo para escanear el QR
        if (hasPendingQR && statusCode === undefined && !errorMessage) {
          console.log('QR pending, waiting for user to scan. Not reconnecting automatically.');
          this.updateStatus(businessId, 'WAITING_QR_SCAN');
          // No eliminar el socket ni reconectar, solo esperar
          // Pero mantener el socket en el mapa por si se reconecta automáticamente
          return;
        }
        
        // Código 515 = restart required (normal después del pairing)
        if (statusCode === 515) {
          console.log('Restart required after pairing, reinitializing...');
          // Habilitar WhatsApp Web automáticamente después del pairing
          try {
            await this.prisma.botConfig.update({
              where: { businessId },
              data: { whatsappWebEnabled: true } as any,
            });
            console.log('WhatsApp Web enabled automatically after pairing restart for businessId:', businessId);
          } catch (error) {
            console.error('Error enabling WhatsApp Web after pairing restart:', error);
          }
          // Cerrar el socket actual antes de reinicializar
          if (this.sockets.has(businessId)) {
            const existingSock = this.sockets.get(businessId);
            try {
              if (existingSock) {
                await existingSock.end(undefined);
              }
            } catch (error) {
              console.error('Error closing socket after restart required:', error);
            }
          }
          this.sockets.delete(businessId);
          this.initializing.set(businessId, false); // Liberar el lock
          // Cancelar cualquier reinicialización pendiente para evitar conflictos
          if (this.reinitTimeouts && this.reinitTimeouts.has(businessId)) {
            clearTimeout(this.reinitTimeouts.get(businessId));
            this.reinitTimeouts.delete(businessId);
          }
          // Usar un delay único para evitar múltiples llamadas simultáneas
          if (!this.reinitTimeouts) {
            this.reinitTimeouts = new Map();
          }
          const timeoutId = setTimeout(() => {
            console.log('Reinitializing after restart required (515)...');
            this.reinitTimeouts?.delete(businessId);
            this.initializeClient(businessId, true); // forceInit = true para asegurar inicialización
          }, 3000); // Aumentar delay a 3 segundos
          this.reinitTimeouts.set(businessId, timeoutId);
          return;
        }
        
        // Código 440 = Conflict (múltiples conexiones simultáneas)
        // Esto significa que ya hay otra conexión activa, no reintentar
        if (statusCode === 440) {
          console.log('Connection conflict (440) - Another connection is active, closing this one...');
          this.sockets.delete(businessId);
          this.initializing.set(businessId, false); // Liberar el lock
          this.updateStatus(businessId, 'READY'); // La otra conexión está activa
          return;
        }
        
        // Código 401 = Connection Failure (credenciales inválidas o sesión corrupta)
        if (statusCode === 401) {
          console.log('Connection failure (401) - Invalid credentials, clearing session and generating new QR...');
          this.sockets.delete(businessId);
          this.initializing.set(businessId, false); // Liberar el lock
          // Limpiar sesión corrupta antes de reintentar
          await this.clearSession(businessId);
          // Limpiar archivos de autenticación de Baileys
          this.clearAuthFiles(businessId);
          // Limpiar QR y pairing codes
          this.pairingCodes.delete(businessId);
          // Esperar un poco antes de reintentar para generar nuevo QR
          setTimeout(() => {
            console.log('Reinitializing after clearing invalid session...');
            this.initializeClient(businessId);
          }, 2000);
          return;
        }
        
        // Verificar si es un error de red/DNS
        if (errorMessage.includes('getaddrinfo') || errorMessage.includes('EAI_AGAIN') || errorMessage.includes('ENOTFOUND')) {
          console.error('Network/DNS error connecting to WhatsApp Web. Check your internet connection.');
          this.sockets.delete(businessId);
          this.initializing.set(businessId, false); // Liberar el lock
          this.updateStatus(businessId, 'ERROR_NETWORK');
          return;
        }
        
        // Si hay un QR pendiente, esperar más tiempo antes de reconectar
        if (hasPendingQR) {
          console.log('QR pending, waiting longer before reconnecting (30 seconds)...');
          this.updateStatus(businessId, 'WAITING_QR_SCAN');
          setTimeout(() => {
            // Solo reconectar si el QR sigue pendiente después de 30 segundos
            if (this.pairingCodes.has(businessId)) {
              console.log('QR still pending after 30s, reconnecting...');
              this.sockets.delete(businessId);
              this.initializing.set(businessId, false);
              this.initializeClient(businessId);
            }
          }, 30000);
          return;
        }
        
        if (statusCode !== DisconnectReason.loggedOut) {
          // Reconnect después de un delay para otros errores
          console.log('Attempting to reconnect in 5 seconds...');
          this.sockets.delete(businessId);
          this.initializing.set(businessId, false); // Liberar el lock
          setTimeout(() => {
            console.log('Reconnecting...');
            this.initializeClient(businessId);
          }, 5000);
        } else {
          this.sockets.delete(businessId);
          this.initializing.set(businessId, false); // Liberar el lock
          this.clearSession(businessId);
        }
      } else if (connection === 'open') {
        console.log('Connection opened successfully');
        this.updateStatus(businessId, 'READY');
        this.initializing.set(businessId, false); // Liberar el lock cuando la conexión está abierta
        // Limpiar el QR ya que la conexión está establecida
        this.pairingCodes.delete(businessId);
        // Asegurarse de que el socket esté en el mapa
        if (!this.sockets.has(businessId)) {
          console.log('Socket missing from map after connection open, re-adding...');
          this.sockets.set(businessId, sock);
        }
        // Habilitar WhatsApp Web automáticamente cuando la conexión se abre exitosamente
        try {
          const currentConfig = await this.prisma.botConfig.findUnique({
            where: { businessId },
            select: { whatsappWebEnabled: true },
          });
          if (!currentConfig?.whatsappWebEnabled) {
            await this.prisma.botConfig.update({
              where: { businessId },
              data: { whatsappWebEnabled: true } as any,
            });
            console.log('WhatsApp Web enabled automatically after successful connection for businessId:', businessId);
          }
        } catch (error) {
          console.error('Error enabling WhatsApp Web:', error);
        }
      } else if (connection === 'connecting') {
        console.log('Connecting to WhatsApp Web...');
        this.updateStatus(businessId, 'CONNECTING');
      }
      
      console.log('connection update', update);
    });

    sock.ev.on('creds.update', async () => {
      console.log('Credentials updated, saving...');
      await saveCreds();
      // Save session
      try {
        const sessionStr = JSON.stringify(state);
        await this.prisma.botConfig.upsert({
          where: { businessId },
          update: { whatsappWebSession: sessionStr } as any,
          create: { businessId, whatsappWebSession: sessionStr } as any,
        });
        console.log('Session saved successfully');
      } catch (error) {
        console.error('Error saving session:', error);
      }
    });

    sock.ev.on('contacts.upsert', async (contacts) => {
      try {
        for (const contact of contacts) {
          if (!contact.id) continue;
          await this.prisma.whatsAppContact.upsert({
            where: {
              businessId_jid: {
                businessId,
                jid: contact.id,
              },
            },
            update: {
              name: contact.name || contact.notify || undefined,
              notifyName: contact.notify || undefined,
            },
            create: {
              businessId,
              jid: contact.id,
              name: contact.name || contact.notify || null,
              notifyName: contact.notify || null,
            },
          });
        }
      } catch (err) {
        console.error('Error syncing contacts:', err);
      }
    });

    sock.ev.on('groups.upsert', async (groups) => {
      try {
        for (const group of groups) {
          if (!group.id) continue;
          await this.prisma.whatsAppGroup.upsert({
            where: {
              businessId_jid: {
                businessId,
                jid: group.id,
              },
            },
            update: {
              subject: group.subject || '',
            },
            create: {
              businessId,
              jid: group.id,
              subject: group.subject || '',
            },
          });
        }
      } catch (err) {
        console.error('Error syncing groups:', err);
      }
    });

    sock.ev.on('messages.upsert', async (m) => {
      await this.handleMessage(businessId, m);
    });

    sock.ev.on('call', async (calls) => {
      for (const call of calls) {
        if (call.status === 'offer') {
          this.handleCall(businessId, call).catch(err => console.error('Error handling call:', err));
        }
      }
    });

    return sock;
    } catch (error) {
      console.error('Error initializing WhatsApp Web client:', error);
      this.initializing.set(businessId, false); // Liberar el lock en caso de error
      this.sockets.delete(businessId);
      throw error;
    }
  }

  private async storePairingCode(businessId: string, code: string) {
    console.log('Storing QR code for businessId:', businessId, 'Code length:', code?.length);
    this.pairingCodes.set(businessId, code);
    try {
      // Intentar actualizar, si no existe, crear o ignorar
      await this.prisma.botConfig.upsert({
        where: { businessId },
        update: { whatsappWebQr: code } as any,
        create: { businessId, whatsappWebQr: code } as any,
      });
      console.log('QR code stored successfully in database for businessId:', businessId);
    } catch (error) {
      console.error('Error storing QR code in database:', error);
      // El QR sigue disponible en memoria, así que no es crítico
    }
    // Emitir QR por websockets
    try {
      this.websocketGateway.emitLivechatQr(businessId, code);
    } catch (err) {
      console.error('Error emitting livechat QR code:', err);
    }
  }

  private async updateStatus(businessId: string, status: string) {
    try {
      // Usar upsert para crear o actualizar el registro
      await this.prisma.botConfig.upsert({
        where: { businessId },
        update: { whatsappWebStatus: status } as any,
        create: { businessId, whatsappWebStatus: status } as any,
      });
    } catch (error) {
      console.error('Error updating status in database:', error);
      // El estado se puede mantener solo en memoria si falla la BD
    }
    // Emitir estado por websockets
    try {
      this.websocketGateway.emitLivechatStatus(businessId, status, this.pairingCodes.get(businessId));
    } catch (err) {
      console.error('Error emitting livechat status:', err);
    }
  }

  async getPairingCode(businessId: string): Promise<string | null> {
    // Buscar primero en memoria (más rápido y reciente)
    const memoryQr = this.pairingCodes.get(businessId);
    if (memoryQr) {
      console.log('QR found in memory for businessId:', businessId);
      return memoryQr;
    }
    
    // Si no está en memoria, buscar en la base de datos
    const config = await this.prisma.botConfig.findUnique({
      where: { businessId },
      select: { whatsappWebQr: true },
    });
    
    const dbQr = config?.whatsappWebQr || null;
    if (dbQr) {
      console.log('QR found in database for businessId:', businessId);
      // Guardar en memoria para futuras consultas
      this.pairingCodes.set(businessId, dbQr);
    } else {
      console.log('No QR found for businessId:', businessId);
    }
    
    return dbQr;
  }

  async getStatus(businessId: string): Promise<string | null> {
    const config = await this.prisma.botConfig.findUnique({
      where: { businessId },
    });
    return config?.whatsappWebStatus || null;
  }

  async closeClient(businessId: string) {
    // Cerrar socket si existe
    const sock = this.sockets.get(businessId);
    if (sock) {
      try {
        await sock.end(undefined);
      } catch (error) {
        console.error('Error ending socket:', error);
      }
      this.sockets.delete(businessId);
    }
    // Liberar el lock de inicialización
    this.initializing.set(businessId, false);
    // Limpiar QR y pairing codes
    this.pairingCodes.delete(businessId);
    // Actualizar estado en BD
    await this.updateStatus(businessId, 'DISABLED');
  }

  /**
   * Genera un mensaje de bienvenida personalizado según el rubro del negocio
   */
  private generateWelcomeMessage(
    businessName: string,
    industryType: string,
    customWelcomeMessage?: string | null,
  ): string {
    // Si hay un mensaje personalizado configurado, usarlo pero asegurar que incluya el nombre del negocio
    if (customWelcomeMessage) {
      // Si el mensaje personalizado no incluye el nombre del negocio, agregarlo al inicio
      if (!customWelcomeMessage.includes(businessName)) {
        return `*${businessName}*\n\n${customWelcomeMessage}`;
      }
      return customWelcomeMessage;
    }

    // Mensajes de bienvenida personalizados según el rubro
    const welcomeMessages: Record<string, string> = {
      RESTAURANT: `🍽️ *${businessName}*

¡Bienvenido! Somos ${businessName}, tu restaurante de confianza.

Estamos comprometidos con ofrecerte la mejor experiencia gastronómica:

✨ *Nuestros Servicios:*
• Menú completo con platos del día
• Reservas de mesa
• Pedidos para llevar
• Opciones vegetarianas y veganas
• Eventos y celebraciones

📋 Puedo ayudarte con:
• Consultar nuestro menú y precios
• Realizar pedidos
• Reservar una mesa
• Información sobre promociones

Estamos aquí para atenderte. ¿En qué puedo asistirte hoy?`,

      CLINIC: `🏥 *${businessName}*

¡Bienvenido! Somos ${businessName}, tu centro de salud de confianza.

Estamos comprometidos con tu bienestar y ofrecemos servicios de calidad:

✨ *Nuestros Servicios:*
• Consultas médicas generales y especializadas
• Exámenes y laboratorios clínicos
• Atención preventiva y seguimiento
• Farmacia y productos farmacéuticos
• Asesoría en salud y medicamentos

📋 *¿Cómo puedo ayudarte?*
• Agendar citas médicas
• Consultar horarios de atención
• Información sobre servicios y precios
• Consultas sobre medicamentos y productos
• Recordatorios de citas

Estamos aquí para atenderte. ¿En qué puedo asistirte hoy?`,

      REAL_ESTATE: `🏢 *${businessName}*

¡Bienvenido! Somos ${businessName}, tu socio inmobiliario de confianza.

Estamos comprometidos con ayudarte a encontrar la propiedad perfecta:

✨ *Nuestros Servicios:*
• Venta de propiedades
• Alquiler de inmuebles
• Asesoría en bienes raíces
• Tasaciones profesionales
• Gestión de propiedades

📋 Puedo ayudarte con:
• Buscar propiedades disponibles
• Agendar visitas a propiedades
• Información sobre precios y ubicaciones
• Consultas sobre financiamiento

Estamos aquí para atenderte. ¿En qué puedo asistirte hoy?`,

      ACADEMY: `🎓 *${businessName}*

¡Bienvenido! Somos ${businessName}, tu centro educativo de confianza.

Estamos comprometidos con tu educación y desarrollo profesional:

✨ *Nuestros Servicios:*
• Cursos y programas educativos
• Clases personalizadas
• Preparación para exámenes
• Talleres y seminarios
• Certificaciones

📋 Puedo ayudarte con:
• Información sobre cursos disponibles
• Inscripciones y matrículas
• Horarios y disponibilidad
• Precios y planes de pago

Estamos aquí para atenderte. ¿En qué puedo asistirte hoy?`,

      RETAIL: `🛍️ *${businessName}*

¡Bienvenido! Somos ${businessName}, tu tienda de confianza.

Estamos comprometidos con ofrecerte los mejores productos y servicios:

✨ *Nuestros Servicios:*
• Productos de calidad
• Asesoría personalizada
• Envíos a domicilio
• Garantías y soporte
• Promociones especiales

📋 Puedo ayudarte con:
• Consultar productos y precios
• Realizar pedidos
• Información sobre disponibilidad
• Agendar citas para consultas

Estamos aquí para atenderte. ¿En qué puedo asistirte hoy?`,

      SERVICES: `⚙️ *${businessName}*

¡Bienvenido! Somos ${businessName}, tu proveedor de servicios de confianza.

Estamos comprometidos con brindarte el mejor servicio:

✨ *Nuestros Servicios:*
• Servicios profesionales de calidad
• Atención personalizada
• Soluciones a medida
• Soporte continuo
• Garantía de satisfacción

📋 Puedo ayudarte con:
• Información sobre nuestros servicios
• Agendar citas o consultas
• Consultar precios y disponibilidad
• Resolver tus dudas

Estamos aquí para atenderte. ¿En qué puedo asistirte hoy?`,

      OTHER: `*${businessName}*

¡Bienvenido! Somos ${businessName}, tu socio de confianza.

Estamos comprometidos con la excelencia y ofrecemos:

✨ *Nuestros Servicios:*
• Atención personalizada y profesional
• Soluciones adaptadas a tus necesidades
• Calidad garantizada
• Soporte continuo y dedicado

📋 *¿Cómo puedo ayudarte?*
• Información sobre nuestros servicios
• Agendar citas o consultas
• Resolver tus dudas
• Consultar disponibilidad y precios

Estamos aquí para atenderte. ¿En qué puedo asistirte hoy?`,
    };

    return welcomeMessages[industryType] || welcomeMessages.OTHER;
  }

  async deleteSession(businessId: string) {
    const sock = this.sockets.get(businessId);
    if (sock) {
      try {
        console.log('Logging out WhatsApp Web session for businessId:', businessId);
        await sock.logout();
      } catch (error) {
        console.error('Error logging out from WhatsApp:', error);
      }
    }
    await this.closeClient(businessId);

    // Esperar a que se liberen los descriptores de archivos (especialmente en Windows)
    await new Promise(resolve => setTimeout(resolve, 1500));

    // Limpiar archivos de autenticación
    this.clearAuthFiles(businessId);
    // Limpiar sesión en BD
    await this.clearSession(businessId);
  }

  private async clearSession(businessId: string) {
    try {
      await this.prisma.botConfig.upsert({
        where: { businessId },
        update: {
          whatsappWebSession: null,
          whatsappWebQr: null,
          whatsappWebStatus: 'DISABLED',
          whatsappWebEnabled: false,
        } as any,
        create: {
          businessId,
          whatsappWebSession: null,
          whatsappWebQr: null,
          whatsappWebStatus: 'DISABLED',
          whatsappWebEnabled: false,
        } as any,
      });
      console.log('Session cleared for businessId:', businessId);
    } catch (error) {
      console.error('Error clearing session:', error);
    }
  }

  private clearAuthFiles(businessId: string) {
    try {
      const sessionsDir = join(process.cwd(), 'whatsapp_auth_sessions');
      const authDir = join(sessionsDir, businessId);
      if (existsSync(authDir)) {
        console.log('Clearing auth files for businessId:', businessId);
        rmSync(authDir, { recursive: true, force: true });
      }
    } catch (error) {
      console.error('Error clearing auth files:', error);
    }
  }

  async sendMessage(businessId: string, to: string, content: string, options?: any) {
    // Verificar que WhatsApp Web esté habilitado antes de enviar
    const config = await this.prisma.botConfig.findUnique({
      where: { businessId },
      select: { whatsappWebEnabled: true, whatsappMode: true },
    });

    const isEnabled = config?.whatsappWebEnabled === true || 
                     (config?.whatsappMode === 'WHATSAPP_WEB' && config?.whatsappWebEnabled !== false);
    
    if (!isEnabled) {
      throw new Error('WhatsApp Web is not enabled for this business');
    }

    const sock = this.sockets.get(businessId);
    if (!sock) {
      throw new Error('Socket not found. WhatsApp Web may not be initialized');
    }

    const jid = to.includes('@') ? to : `${to}@s.whatsapp.net`;
    return sock.sendMessage(jid, { text: content }, options);
  }

  /**
   * Envía una imagen desde WhatsApp Web
   * @param businessId ID del negocio
   * @param to Número de destino (con @s.whatsapp.net)
   * @param imageBuffer Buffer de la imagen
   * @param caption Texto opcional para la imagen
   * @param mimetype Tipo MIME de la imagen (default: image/jpeg)
   */
  async sendImage(
    businessId: string,
    to: string,
    imageBuffer: Buffer,
    caption?: string,
    mimetype: string = 'image/jpeg',
  ): Promise<void> {
    const sock = this.sockets.get(businessId);
    if (!sock) {
      console.error('Socket not found for businessId:', businessId);
      throw new Error('WhatsApp Web client not initialized');
    }

    try {
      await sock.sendMessage(to, {
        image: imageBuffer,
        caption: caption || '',
        mimetype,
      });
    } catch (error) {
      console.error('Error sending image:', error);
      throw error;
    }
  }

  /**
   * Envía un video desde WhatsApp Web
   * @param businessId ID del negocio
   * @param to Número de destino (con @s.whatsapp.net)
   * @param videoBuffer Buffer del video
   * @param caption Texto opcional para el video
   * @param mimetype Tipo MIME del video (default: video/mp4)
   */
  async sendVideo(
    businessId: string,
    to: string,
    videoBuffer: Buffer,
    caption?: string,
    mimetype: string = 'video/mp4',
  ): Promise<void> {
    const sock = this.sockets.get(businessId);
    if (!sock) {
      console.error('Socket not found for businessId:', businessId);
      throw new Error('WhatsApp Web client not initialized');
    }

    try {
      await sock.sendMessage(to, {
        video: videoBuffer,
        caption: caption || '',
        mimetype,
      });
    } catch (error) {
      console.error('Error sending video:', error);
      throw error;
    }
  }

  /**
   * Envía un documento desde WhatsApp Web
   * @param businessId ID del negocio
   * @param to Número de destino (con @s.whatsapp.net)
   * @param documentBuffer Buffer del documento
   * @param filename Nombre del archivo
   * @param mimetype Tipo MIME del documento
   * @param caption Texto opcional para el documento
   */
  async sendDocument(
    businessId: string,
    to: string,
    documentBuffer: Buffer,
    filename: string,
    mimetype: string,
    caption?: string,
  ): Promise<void> {
    const sock = this.sockets.get(businessId);
    if (!sock) {
      console.error('Socket not found for businessId:', businessId);
      throw new Error('WhatsApp Web client not initialized');
    }

    try {
      await sock.sendMessage(to, {
        document: documentBuffer,
        fileName: filename,
        mimetype,
        caption: caption || '',
      });
    } catch (error) {
      console.error('Error sending document:', error);
      throw error;
    }
  }

  /**
   * Envía un audio desde WhatsApp Web
   * @param businessId ID del negocio
   * @param to Número de destino (con @s.whatsapp.net)
   * @param audioBuffer Buffer del audio
   * @param mimetype Tipo MIME del audio (por defecto audio/mpeg)
   * @param ptt Si es true, se envía como nota de voz (push-to-talk)
   */
  async sendAudio(
    businessId: string,
    to: string,
    audioBuffer: Buffer,
    mimetype: string = 'audio/mpeg',
    ptt: boolean = false,
  ): Promise<void> {
    const sock = this.sockets.get(businessId);
    if (!sock) {
      console.error('Socket not found for businessId:', businessId);
      throw new Error('WhatsApp Web client not initialized');
    }

    try {
      await sock.sendMessage(to, {
        audio: audioBuffer,
        mimetype,
        ptt, // Push-to-talk (nota de voz)
      });
    } catch (error) {
      console.error('Error sending audio:', error);
      throw error;
    }
  }

  /**
   * Envía una imagen desde un archivo (por ID o ruta)
   */
  async sendImageFromFile(
    businessId: string,
    to: string,
    fileId?: string,
    filePath?: string,
    caption?: string,
  ): Promise<void> {
    let buffer: Buffer;
    let mimetype: string = 'image/jpeg';
    let filename: string = 'image.jpg';

    if (fileId) {
      const file = await this.prisma.file.findUnique({
        where: { id: fileId },
      });
      if (!file) {
        throw new Error('File not found');
      }
      buffer = readFileSync(file.url);
      mimetype = file.mimeType;
      filename = file.originalName;
    } else if (filePath) {
      if (!existsSync(filePath)) {
        throw new Error('File path does not exist');
      }
      buffer = readFileSync(filePath);
      // Intentar detectar mimetype desde la extensión
      const ext = filePath.split('.').pop()?.toLowerCase();
      if (ext === 'png') mimetype = 'image/png';
      else if (ext === 'gif') mimetype = 'image/gif';
      else if (ext === 'webp') mimetype = 'image/webp';
      filename = filePath.split('/').pop() || 'image.jpg';
    } else {
      throw new Error('Either fileId or filePath must be provided');
    }

    await this.sendImage(businessId, to, buffer, caption, mimetype);
  }

  /**
   * Envía un video desde un archivo (por ID o ruta)
   */
  async sendVideoFromFile(
    businessId: string,
    to: string,
    fileId?: string,
    filePath?: string,
    caption?: string,
  ): Promise<void> {
    let buffer: Buffer;
    let mimetype: string = 'video/mp4';
    let filename: string = 'video.mp4';

    if (fileId) {
      const file = await this.prisma.file.findUnique({
        where: { id: fileId },
      });
      if (!file) {
        throw new Error('File not found');
      }
      buffer = readFileSync(file.url);
      mimetype = file.mimeType;
      filename = file.originalName;
    } else if (filePath) {
      if (!existsSync(filePath)) {
        throw new Error('File path does not exist');
      }
      buffer = readFileSync(filePath);
      const ext = filePath.split('.').pop()?.toLowerCase();
      if (ext === 'avi') mimetype = 'video/avi';
      else if (ext === 'mov') mimetype = 'video/mov';
      filename = filePath.split('/').pop() || 'video.mp4';
    } else {
      throw new Error('Either fileId or filePath must be provided');
    }

    await this.sendVideo(businessId, to, buffer, caption, mimetype);
  }

  /**
   * Envía un documento desde un archivo (por ID o ruta)
   */
  async sendDocumentFromFile(
    businessId: string,
    to: string,
    fileId?: string,
    filePath?: string,
    caption?: string,
  ): Promise<void> {
    let buffer: Buffer;
    let mimetype: string = 'application/pdf';
    let filename: string = 'document.pdf';

    if (fileId) {
      const file = await this.prisma.file.findUnique({
        where: { id: fileId },
      });
      if (!file) {
        throw new Error('File not found');
      }
      buffer = readFileSync(file.url);
      mimetype = file.mimeType;
      filename = file.originalName;
    } else if (filePath) {
      if (!existsSync(filePath)) {
        throw new Error('File path does not exist');
      }
      buffer = readFileSync(filePath);
      const ext = filePath.split('.').pop()?.toLowerCase();
      if (ext === 'doc' || ext === 'docx') mimetype = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
      else if (ext === 'xls' || ext === 'xlsx') mimetype = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
      else if (ext === 'txt') mimetype = 'text/plain';
      filename = filePath.split('/').pop() || 'document.pdf';
    } else {
      throw new Error('Either fileId or filePath must be provided');
    }

    await this.sendDocument(businessId, to, buffer, filename, mimetype, caption);
  }

  /**
   * Envía un audio desde un archivo (por ID o ruta)
   */
  async sendAudioFromFile(
    businessId: string,
    to: string,
    fileId?: string,
    filePath?: string,
    ptt: boolean = false,
  ): Promise<void> {
    let buffer: Buffer;
    let mimetype: string = 'audio/mpeg';
    let filename: string = 'audio.mp3';

    if (fileId) {
      const file = await this.prisma.file.findUnique({
        where: { id: fileId },
      });
      if (!file) {
        throw new Error('File not found');
      }
      buffer = readFileSync(file.url);
      mimetype = file.mimeType;
      filename = file.originalName;
    } else if (filePath) {
      if (!existsSync(filePath)) {
        throw new Error('File path does not exist');
      }
      buffer = readFileSync(filePath);
      const ext = filePath.split('.').pop()?.toLowerCase();
      if (ext === 'wav') mimetype = 'audio/wav';
      else if (ext === 'ogg') mimetype = 'audio/ogg';
      else if (ext === 'm4a') mimetype = 'audio/mp4';
      else if (ext === 'opus') mimetype = 'audio/ogg; codecs=opus';
      filename = filePath.split('/').pop() || 'audio.mp3';
    } else {
      throw new Error('Either fileId or filePath must be provided');
    }

    await this.sendAudio(businessId, to, buffer, mimetype, ptt);
  }

  async handleMessage(businessId: string, m: any) {
    console.log(`[WhatsApp Web] Received message event for businessId: ${businessId}`);

    // Verificar que WhatsApp Web esté habilitado antes de procesar
    const config = await this.prisma.botConfig.findUnique({
      where: { businessId },
      select: { whatsappWebEnabled: true, whatsappMode: true },
    });

    const isEnabled = config?.whatsappWebEnabled === true ||
                     (config?.whatsappMode === 'WHATSAPP_WEB' && config?.whatsappWebEnabled !== false);

    if (!isEnabled) {
      console.log('WhatsApp Web is not enabled, ignoring message for businessId:', businessId);
      return;
    }

    const msg = m.messages[0];
    if (!msg) {
      console.log('[WhatsApp Web] No message found in event');
      return;
    }

    if (msg.key.fromMe) {
      console.log('[WhatsApp Web] Message from self detected. It will be saved but not trigger AI.');
    }

    // --- INDUSTRIALIZACIÓN: Delegar a cola persistente (BullMQ) ---
    // Esto permite procesamiento en paralelo de alta calidad y persistencia ante reinicios
    try {
      await this.jobsService.queueWhatsappMessage(businessId, m);
    } catch (err: any) {
      console.warn(`[WhatsApp Web] Fallback a procesamiento directo. JobsService falló al encolar: ${err.message}`);
      await this.processSingleMessage(businessId, m).catch(innerErr => {
        console.error(`[WhatsApp Web] Error en procesamiento de fallback síncrono:`, innerErr);
      });
    }
  }

  public async processSingleMessage(businessId: string, m: any) {
    
    const msg = m.messages[0];
    console.log(`[WhatsApp Web] Processing message from ${msg.key.remoteJid}, messageId: ${msg.key.id}`);

    let sock = this.sockets.get(businessId);
    if (!sock) {
      console.error('Socket not found for businessId:', businessId);
      // Intentar reinicializar si WhatsApp Web está habilitado
      const config = await this.prisma.botConfig.findUnique({
        where: { businessId },
        select: { whatsappWebEnabled: true, respondInGroups: true },
      });
      if (config?.whatsappWebEnabled) {
        console.log('Attempting to reinitialize WhatsApp Web client...');
        try {
          await this.initializeClient(businessId);
          sock = this.sockets.get(businessId);
          if (!sock) {
            console.error('Failed to reinitialize socket');
            return;
          }
        } catch (error) {
          console.error('Error reinitializing socket:', error);
          return;
        }
      } else {
        return;
      }
    }

    const fromJid = msg.key.remoteJid; // Mantener el JID completo para enviar mensajes
    // Normalizar el teléfono: extraer solo el número, removiendo @s.whatsapp.net, @lid, @g.us, etc.
    let from = fromJid.split('@')[0]; // Extraer solo la parte antes del @
    // Si el número tiene formato con código de país, asegurarse de que esté completo
    // Ejemplo: 152617669914787 -> 152617669914787 (ya está bien)
    // Ejemplo: 51974501998 -> 51974501998 (ya está bien)
    
    const text = msg.message?.conversation || msg.message?.extendedTextMessage?.text || '';

    // Check if it's a group message and if the bot should respond
    const isGroup = fromJid.endsWith('@g.us');
    
    // Fetch config to check respondInGroups
    const groupCheckConfig = await this.prisma.botConfig.findUnique({
      where: { businessId },
      select: { respondInGroups: true }
    });

    if (isGroup && !groupCheckConfig?.respondInGroups) {
      console.log(`[WhatsApp Web] Group message from ${fromJid} ignored because respondInGroups is disabled`);
      return;
    }
    
    // =====================================================================
    // AUDIO ENTRANTE: Transcribir mensajes de voz con Whisper
    // =====================================================================
    let audioTranscription: string | null = null;
    const isAudioMessage = !!(msg.message?.audioMessage || msg.message?.pttMessage);

    if (isAudioMessage) {
      // --- PLAN CHECK: Transcription ---
      const hasTranscription = await this.planService.hasFeatureAccess(businessId, 'hasVoiceTranscription');
      if (!hasTranscription) {
        console.log(`[WhatsApp Web] Transcription feature NOT allowed for businessId: ${businessId}. Skipping.`);
        await this.sendMessage(businessId, fromJid, '🎙️ Tu plan actual no incluye la transcripción de audios. Por favor, contáctanos por texto.');
        return;
      }

      try {
        console.log('[WhatsApp Web] Mensaje de audio detectado, transcribiendo...');
        const audioBuffer = await downloadMediaMessage(msg, 'buffer', {});
        const audioInfo = msg.message?.audioMessage || msg.message?.pttMessage;
        const mimeType = audioInfo?.mimetype || 'audio/ogg; codecs=opus';
        
        audioTranscription = await this.sttService.transcribeAudio(audioBuffer as Buffer, mimeType);
        
        if (audioTranscription && audioTranscription.trim()) {
          console.log(`[WhatsApp Web] ✅ Transcripción: "${audioTranscription}"`);
        } else {
          console.log('[WhatsApp Web] No se pudo transcribir el audio.');
          await this.sendMessage(businessId, fromJid, '🎙️ Recibí tu nota de voz, pero no pude entenderla claramente. ¿Podrías escribirme tu consulta?');
          return;
        }
      } catch (err) {
        console.error('[WhatsApp Web] Error transcribiendo audio:', err);
        await this.sendMessage(businessId, fromJid, '🎙️ Recibí tu nota de voz, pero tuve un error al procesarla. Por favor escríbeme.');
        return;
      }
    }

    // Usar transcripción de audio si existe, de lo contrario usar texto del mensaje
    const effectiveText = audioTranscription || text;

    console.log(`[WhatsApp Web] Extracted text from message: "${effectiveText}"`);
    console.log(`[WhatsApp Web] Normalized phone: "${from}" from JID: "${fromJid}"`);
    
    if (!effectiveText || effectiveText.trim() === '') {
      console.log('[WhatsApp Web] Message has no text content, skipping AI response');
      // Si no hay texto ni audio, podría ser solo un emoji o sticker
      return;
    }

    const existingMessages = await this.prisma.message.findMany({
      where: {
        businessId,
        OR: [
          { from: from },
          { to: from },
        ],
      },
      orderBy: { createdAt: 'asc' },
      take: 1,
    });
    
    const isFirstMessage = existingMessages.length === 0;

    const isFromMe = msg.key.fromMe;
    const direction = isFromMe ? 'OUTBOUND' : 'INBOUND';

    // Create message in DB (usar upsert para evitar duplicados)
    const savedMessage = await this.prisma.message.upsert({
      where: {
        externalId: msg.key.id,
      },
      update: {
        content: text,
        status: 'DELIVERED',
      },
      create: {
        businessId,
        externalId: msg.key.id,
        direction,
        content: text,
        from: isFromMe ? '' : from,
        to: isFromMe ? from : '',
        status: 'DELIVERED',
      },
    });

    // Emitir mensaje por WebSocket al Frontend inmediatamente
    try {
      this.websocketGateway.emitNewMessage(businessId, savedMessage);
    } catch (wsErr) {
      console.error('[WhatsApp Web] Error emitting ws message:', wsErr);
    }

    // Si es un mensaje enviado por nosotros mismos (desde WebChat o Bot), no activar IA
    if (isFromMe) {
      return;
    }

    // Check for confirmation of evidence
    if ((text.toLowerCase() === 'sí' || text.toLowerCase() === 'si') && this.pendingEvidence.has(from)) {
      const evidence = this.pendingEvidence.get(from)!;
      const config = await this.prisma.botConfig.findUnique({
        where: { businessId },
        select: { reviewerDestination: true },
      });
      if (config?.reviewerDestination) {
        // Formatear el número del revisor como JID si no lo está
        const reviewerJid = config.reviewerDestination.includes('@') 
          ? config.reviewerDestination 
          : `${config.reviewerDestination}@s.whatsapp.net`;
        try {
          // Enviar media usando el socket
          await sock.sendMessage(reviewerJid, { 
            image: evidence.media.data || evidence.media,
            caption: `Evidencia confirmada de ${evidence.from}: ${evidence.text}`
          });
        } catch (error) {
          console.error('Error sending media to reviewer:', error);
          // Intentar enviar solo texto si falla el envío de media
          await this.sendMessage(businessId, reviewerJid, `Evidencia confirmada de ${evidence.from}: ${evidence.text}`);
        }
      }
      this.pendingEvidence.delete(from);
      await this.sendMessage(businessId, fromJid, 'Evidencia enviada al especialista para revisión.');
      return; // Don't send AI response for confirmation
    }

    // Check for security code (payment verification)
    if (this.pendingPayments.has(from)) {
      const paymentData = this.pendingPayments.get(from)!;
      // Verificar si el texto es un código de seguridad (6 dígitos)
      const securityCodeMatch = text.match(/\d{6}/);
      if (securityCodeMatch) {
        const securityCode = securityCodeMatch[0];
        
        // Buscar el comprobante pendiente
        const receipt = await this.prisma.paymentReceipt.findFirst({
          where: {
            businessId,
            receiptFileId: paymentData.fileId,
            status: 'PENDING',
          },
        });

        if (receipt) {
          // Actualizar código de seguridad
          await this.prisma.paymentReceipt.update({
            where: { id: receipt.id },
            data: { securityCode },
          });

          // Verificar código
          try {
            const verifyResult = await this.paymentService.verifySecurityCode(receipt.id);
            
            if (verifyResult.receipt && verifyResult.receipt.status === 'VERIFIED') {
              // Pago verificado, generar boleta
              const invoice = await this.invoiceService.generateInvoice({
                paymentReceiptId: receipt.id,
              });
              
              const invoiceData = await this.invoiceService.sendInvoiceToCustomer(invoice.id);
              
              await this.sendMessage(businessId, fromJid, invoiceData.message);
              
              // Enviar boleta PDF
              const invoiceFile = await this.prisma.file.findUnique({
                where: { id: invoice.invoiceFileId },
              });
              
              if (invoiceFile && existsSync(invoiceFile.url)) {
                const invoiceBuffer = readFileSync(invoiceFile.url);
                await sock.sendMessage(fromJid, {
                  document: invoiceBuffer,
                  mimetype: 'application/pdf',
                  fileName: invoiceFile.originalName,
                });
              }
            } else {
              await this.sendMessage(businessId, fromJid, verifyResult.message || 'El código no se pudo verificar. Se requiere revisión manual.');
            }
          } catch (error) {
            console.error('Error verifying security code:', error);
            await this.sendMessage(businessId, fromJid, 'Hubo un error al verificar el código. Por favor, intenta nuevamente.');
          }
        }
        
        this.pendingPayments.delete(from);
        return; // Don't send AI response for security code
      }
    }

    // Handle media (imágenes, videos, documentos)
    if (msg.message?.imageMessage || msg.message?.videoMessage || msg.message?.documentMessage) {
      try {
        // Usar downloadMediaMessage de baileys para descargar el media
        const media = await downloadMediaMessage(msg, 'buffer', {});
        const mediaType = msg.message?.imageMessage ? 'image' : msg.message?.videoMessage ? 'video' : 'document';
        const mediaInfo = msg.message?.imageMessage || msg.message?.videoMessage || msg.message?.documentMessage;
        const fileName = mediaInfo?.fileName || (mediaType === 'image' ? 'image.jpg' : mediaType === 'video' ? 'video.mp4' : 'document.pdf');
        const mimeType = mediaInfo?.mimetype || (mediaType === 'image' ? 'image/jpeg' : mediaType === 'video' ? 'video/mp4' : 'application/pdf');
        
        // Guardar el archivo en la BD
        const uploadsDir = join(process.cwd(), 'uploads');
        if (!existsSync(uploadsDir)) {
          require('fs').mkdirSync(uploadsDir, { recursive: true });
        }
        
        const fileExtension = fileName.split('.').pop() || (mediaType === 'image' ? 'jpg' : mediaType === 'video' ? 'mp4' : 'pdf');
        const uniqueFileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExtension}`;
        const filePath = join(uploadsDir, uniqueFileName);
        
        writeFileSync(filePath, media);
        
        // Determinar tipo de archivo para Prisma
        let fileType: 'IMAGE' | 'VIDEO' | 'DOCUMENT' | 'AUDIO' | 'OTHER' = 'OTHER';
        if (mediaType === 'image') fileType = 'IMAGE';
        else if (mediaType === 'video') fileType = 'VIDEO';
        else if (mediaType === 'document') fileType = 'DOCUMENT';
        
        // Crear registro de archivo en BD
        const file = await this.prisma.file.create({
          data: {
            filename: uniqueFileName,
            originalName: fileName,
            mimeType: mimeType,
            size: media.length,
            url: filePath,
            fileType: fileType,
            isProcessed: false,
            isActive: true,
            businessId: businessId,
            description: text || `Archivo recibido de ${from}`,
            tags: [],
          },
        });
        
        // Guardar el mensaje en la base de datos
        await this.prisma.message.upsert({
          where: {
            externalId: msg.key.id,
          },
          update: {
            content: text || `[${mediaType.toUpperCase()}]`,
            status: 'DELIVERED',
          },
          create: {
            businessId,
            externalId: msg.key.id,
            direction: 'INBOUND',
            content: text || `[${mediaType.toUpperCase()}]`,
            from,
            to: '',
            status: 'DELIVERED',
            metadata: {
              mediaType,
              mimetype: mimeType,
              fileName: fileName,
              fileSize: media.length,
              fileId: file.id,
            } as any,
          },
        });

        // Detectar si es evidencia médica (texto contiene palabras clave)
        const lowerText = (text || '').toLowerCase();
        const isEvidence = lowerText.includes('malestar') || 
                          lowerText.includes('dolor') || 
                          lowerText.includes('síntoma') || 
                          lowerText.includes('sintoma') ||
                          lowerText.includes('tengo esto') ||
                          lowerText.includes('necesito ayuda') ||
                          lowerText.includes('me duele');

        // Detectar si es comprobante de pago (imagen que parece comprobante)
        const isPaymentReceipt = mediaType === 'image' && (
          lowerText.includes('comprobante') ||
          lowerText.includes('pago') ||
          lowerText.includes('recibo') ||
          lowerText.includes('yape') ||
          lowerText.includes('plin') ||
          fileName.toLowerCase().includes('comprobante') ||
          fileName.toLowerCase().includes('pago')
        );

        if (isEvidence) {
          // Es evidencia médica
          const evidenceType = mediaType === 'image' ? EvidenceType.IMAGE : 
                              mediaType === 'video' ? EvidenceType.VIDEO : EvidenceType.AUDIO;
          
          // Obtener nombre del cliente si existe
          const contact = await this.prisma.contact.findFirst({
            where: {
              businessId,
              phone: from,
            },
          });

          const evidence = await this.evidenceService.createEvidence({
            businessId,
            customerPhone: from,
            customerName: contact?.name || undefined,
            evidenceType,
            fileId: file.id,
            description: text || undefined,
          });

          // MEJORA: Enviar al especialista usando archivo desde BD
          const evidenceData = await this.evidenceService.sendToReviewer(evidence.id);
          
          if (evidenceData.reviewerDestination) {
            const reviewerJid = evidenceData.reviewerDestination.includes('@') 
              ? evidenceData.reviewerDestination 
              : `${evidenceData.reviewerDestination}@s.whatsapp.net`;
            
            try {
              // MEJORA: Obtener archivo desde BD en lugar de usar media en memoria
              const evidenceFile = await this.prisma.file.findUnique({
                where: { id: evidence.fileId },
              });

              if (evidenceFile && existsSync(evidenceFile.url)) {
                const fileBuffer = readFileSync(evidenceFile.url);
                const mimeType = evidenceFile.mimeType || 'image/jpeg';
                
                // Determinar tipo de mensaje según mimeType
                let messageType: 'image' | 'video' | 'document' = 'image';
                if (mimeType.startsWith('video/')) {
                  messageType = 'video';
                } else if (mimeType === 'application/pdf' || mimeType.startsWith('application/')) {
                  messageType = 'document';
                }

                await sock.sendMessage(reviewerJid, {
                  [messageType]: fileBuffer,
                  mimetype: mimeType,
                  caption: evidenceData.message,
                });
                
                console.log(`[WhatsApp Web] ✅ Evidencia enviada al especialista: ${reviewerJid}`);
              } else {
                // Fallback: usar media en memoria si el archivo no está disponible
                console.warn(`[WhatsApp Web] ⚠️ Archivo no encontrado en BD, usando media en memoria`);
                await sock.sendMessage(reviewerJid, {
                  [mediaType]: media,
                  caption: evidenceData.message,
                });
              }
            } catch (error: any) {
              console.error('[WhatsApp Web] ❌ Error sending evidence to reviewer:', error);
              await this.sendMessage(businessId, fromJid, 
                '⚠️ Hubo un error al enviar la evidencia al especialista. Por favor, verifica la configuración del número de destino.'
              );
            }
          } else {
            await this.sendMessage(businessId, fromJid, 
              '⚠️ No hay número de especialista configurado. Por favor, configura el número en Configuración → Evidencias Médicas.'
            );
            return;
          }

          await this.sendMessage(businessId, fromJid, '✅ Tus evidencias están siendo evaluadas por el especialista. Para más información, contacta con la asistencia médica.');
        } else if (isPaymentReceipt) {
          // Es comprobante de pago
          await this.sendMessage(businessId, fromJid, '📸 Comprobante recibido. Estoy verificando el monto...');
          
          // Buscar cita pendiente del cliente
          const appointment = await this.prisma.appointment.findFirst({
            where: {
              businessId,
              customerPhone: from,
              status: { in: ['PENDING', 'CONFIRMED'] },
            },
            orderBy: {
              appointmentDate: 'asc',
            },
          });

          // Obtener nombre del cliente
          const contact = await this.prisma.contact.findFirst({
            where: {
              businessId,
              phone: from,
            },
          });

          // Procesar comprobante
          try {
            const paymentResult = await this.paymentService.processReceipt({
              businessId,
              customerPhone: from,
              customerName: contact?.name || undefined,
              receiptFileId: file.id,
              appointmentId: appointment?.id,
            });

            if (paymentResult.needsSecurityCode) {
              // Guardar para esperar código de seguridad
              this.pendingPayments.set(from, {
                fileId: file.id,
                customerPhone: from,
                customerName: contact?.name,
              });
              await this.sendMessage(businessId, fromJid, paymentResult.message || 'Por favor, envía el código de seguridad de tu comprobante para verificación final');
            } else if (paymentResult.receipt && paymentResult.receipt.status === 'VERIFIED') {
              // Pago verificado, generar boleta
              const invoice = await this.invoiceService.generateInvoice({
                paymentReceiptId: paymentResult.receipt.id,
              });
              
              const invoiceData = await this.invoiceService.sendInvoiceToCustomer(invoice.id);
              
              await this.sendMessage(businessId, fromJid, invoiceData.message);
              
              // Enviar boleta PDF
              const invoiceFile = await this.prisma.file.findUnique({
                where: { id: invoice.invoiceFileId },
              });
              
              if (invoiceFile) {
                const invoiceBuffer = readFileSync(invoiceFile.url);
                await sock.sendMessage(fromJid, {
                  document: invoiceBuffer,
                  mimetype: 'application/pdf',
                  fileName: invoiceFile.originalName,
                });
              }
            } else {
              await this.sendMessage(businessId, fromJid, paymentResult.message || '✅ Perfecto, tu pago se procesó con éxito.');
            }
          } catch (error) {
            console.error('Error processing payment:', error);
            await this.sendMessage(businessId, fromJid, 'Hubo un error al procesar tu comprobante. Por favor, intenta nuevamente o contacta con soporte.');
          }
        } else {
          // Obtener el rubro del negocio para validar si es CLINIC
          const business = await this.prisma.business.findUnique({
            where: { id: businessId },
            select: { industryType: true }
          });
          const isClinic = business?.industryType === 'CLINIC';

          if (isClinic && (isEvidence || text === '')) {
            // Preguntar si es evidencia en el caso de clínica y si no hay descripción o si coincide con síntomas
            this.pendingEvidence.set(from, { media, text, from });
            
            if (msg.message?.imageMessage) {
              await this.sendMessage(businessId, fromJid, '📋 He recibido tu evidencia médica. ¿Quieres que la evalúe el especialista? (Sí/No)');
            } else if (msg.message?.documentMessage) {
              await this.sendMessage(businessId, fromJid, `✅ Recibí tu documento: ${fileName}. Si es evidencia para revisión, responde "sí" para enviarla.`);
            } else {
              await this.sendMessage(businessId, fromJid, '✅ Recibí tu video. Si es evidencia para revisión por especialista, responde "sí" para enviarla.');
            }
          } else {
            // No es clínica o el usuario proporcionó una descripción -> Procesar con IA
            const contact = await this.prisma.contact.findFirst({
              where: { businessId, phone: from },
              select: { isAiPaused: true },
            });
            if (contact?.isAiPaused) {
              console.log(`[WhatsApp Web] AI is paused for contact ${from}. Skipping media AI processing.`);
              return;
            }

            console.log(`[WhatsApp Web] Procesando archivo con IA directamente para negocio ${businessId}`);
            
            const fileAttachment = {
              data: media,
              mimeType: mimeType,
              filename: fileName
            };

            const effectiveText = text || 'Analiza esta imagen o archivo y responde a ella.';
            
            const aiResponse = await this.aiService.generateResponse(businessId, effectiveText, from, {
              platform: 'WHATSAPP_WEB',
              senderId: from,
              files: [fileAttachment]
            } as any);

            // Modulación de tono (Swarm)
            let finalMessage = aiResponse.message;
            try {
              const toneService = (this.swarmService as any).peruvianTone;
              if (toneService) {
                const profile = toneService.detectCustomerProfile(effectiveText, { name: from });
                finalMessage = toneService.modulateResponse(aiResponse.message, profile, from);
              }
            } catch (err: any) {
              console.error('[WhatsApp Web] Swarm modulation failed for media, using raw AI:', err.message);
            }

            await this.sendMessage(businessId, fromJid, finalMessage);
          }
        }
      } catch (error) {
        console.error('Error downloading media:', error);
        await this.sendMessage(businessId, fromJid, 'Recibí tu archivo multimedia, pero hubo un error al procesarlo. Por favor, intenta nuevamente.');
      }
      return; // Don't send AI response for media
    }

    // Verificar si la IA está pausada para este contacto
    const contact = await this.prisma.contact.findFirst({
      where: { businessId, phone: from },
      select: { isAiPaused: true },
    });

    if (contact?.isAiPaused) {
      console.log(`[WhatsApp Web] AI is paused for contact ${from}. AI response skipped.`);
      return;
    }

    // Verificar que autoReply esté habilitado y obtener welcomeMessage
    const botConfig = await this.prisma.botConfig.findUnique({
      where: { businessId },
      select: { autoReply: true, welcomeMessage: true },
    });

    if (!botConfig?.autoReply) {
      console.log('Auto-reply is disabled for businessId:', businessId);
      return; // No responder si autoReply está deshabilitado
    }

    // Si es el primer mensaje, enviar mensaje de bienvenida personalizado según el rubro
    if (isFirstMessage) {
      console.log(`[WhatsApp Web] First message from ${from}, sending welcome message`);
      
      // Obtener información del negocio para generar mensaje de bienvenida personalizado
      const business = await this.prisma.business.findUnique({
        where: { id: businessId },
        select: { name: true, industryType: true },
      });
      
      // Generar mensaje de bienvenida personalizado según el rubro
      const welcomeMessage = this.generateWelcomeMessage(
        business?.name || 'nosotros',
        business?.industryType || 'OTHER',
        botConfig.welcomeMessage,
      );
      
      await this.sendMessage(businessId, fromJid, welcomeMessage);
      // Esperar un momento antes de procesar el mensaje del usuario
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    // --- HARDENING: Enforce Plan Limits ---
    const hasAI = await this.planService.hasFeatureAccess(businessId, 'hasAI');
    if (!hasAI) {
      console.log(`[WhatsApp Web] AI feature NOT allowed for businessId: ${businessId}. AI response skipped.`);
      return;
    }

    const limitCheck = await this.planService.checkConversationLimit(businessId);
    if (!limitCheck.allowed) {
      console.log(`[WhatsApp Web] Plan limit reached for businessId: ${businessId}. AI response skipped.`);
      
      // Opcionalmente enviar mensaje de "Límite alcanzado" si es la primera vez
      if (isFirstMessage) {
        await this.sendMessage(businessId, fromJid, 
          'Lo sentimos, este negocio ha alcanzado su límite de mensajes mensuales. Por favor, contacta con ellos por otros medios o intenta más tarde.');
      }
      return;
    }

    // Generate AI response with concurrency control
    console.log(`[WhatsApp Web] Processing message from ${from}: "${effectiveText}"`);
    try {
      // 1. Swarm Safety check first (Safety Guard & Anti-Injection)
      let swarmBlocked = false;
      let safetyResponse = '';
      try {
        const safetyCheck = await this.swarmService.processIncomingMessage(businessId, from, '127.0.0.1', effectiveText);
        if (!safetyCheck.allowed) {
          swarmBlocked = true;
          safetyResponse = safetyCheck.responseMessage;
        }
      } catch (err: any) {
        console.error('[WhatsApp Web] Swarm check failed or blocked target:', err.message);
        if (err.status === 403 || err.statusCode === 403 || err.message.includes('Forbidden') || err.message.includes('restringido')) {
          await this.sendMessage(businessId, fromJid, 'Acceso denegado por seguridad perimetral.');
          return;
        }
      }

      if (swarmBlocked) {
        await this.sendMessage(businessId, fromJid, safetyResponse || 'Acceso denegado.');
        return;
      }

      const aiResponsePromise = this.aiService.generateResponse(businessId, effectiveText, from, {
        platform: 'WHATSAPP_WEB',
        senderId: from,
      });
      const aiResponse = await aiResponsePromise;

      // 2. Swarm Tone modulation post-response
      let finalMessage = aiResponse.message;
      try {
        const toneService = (this.swarmService as any).peruvianTone;
        if (toneService) {
          const profile = toneService.detectCustomerProfile(effectiveText, { name: from });
          finalMessage = toneService.modulateResponse(aiResponse.message, profile, from);
        }
      } catch (err: any) {
        console.error('[WhatsApp Web] Swarm modulation failed, using raw AI response:', err.message);
      }

      console.log(`[WhatsApp Web] AI response generated and modulated: "${finalMessage.substring(0, 50)}..."`);

      // Send text response (usar fromJid que tiene el formato completo)
      this.sendMessage(businessId, fromJid, finalMessage).catch(error => {
        console.error(`[WhatsApp Web] Error sending message to ${from}:`, error);
      });

      // =============================================================
      // RESPUESTA DE AUDIO (TTS): Si el usuario mandó voz y el bot
      // tiene audio habilitado, responder con nota de voz
      // =============================================================
      const botConfigForAudio = await this.prisma.botConfig.findUnique({
        where: { businessId },
        select: { audioEnabled: true } as any,
      });

      if (isAudioMessage && (botConfigForAudio as any)?.audioEnabled) {
        // --- PLAN CHECK: Audio Response ---
        const hasAudioResponse = await this.planService.hasFeatureAccess(businessId, 'hasAudioResponses');
        if (hasAudioResponse) {
          try {
            const audioBuffer = await this.ttsService.generateSpeechBuffer(finalMessage);
            if (audioBuffer) {
              const sock = this.sockets.get(businessId);
              if (sock) {
                await sock.sendMessage(fromJid, {
                  audio: audioBuffer,
                  mimetype: 'audio/mp4',
                  ptt: true, // Enviar como nota de voz
                });
                console.log(`[WhatsApp Web] ✅ Respuesta de audio (TTS) enviada a ${from}`);
              }
            }
          } catch (ttsError) {
            console.error('[WhatsApp Web] Error enviando respuesta de audio:', ttsError);
          }
        } else {
          console.log(`[WhatsApp Web] Audio Response feature NOT allowed for businessId: ${businessId}. Skipping.`);
        }
      }

      // Procesar y enviar medios adicionales si la IA los solicita
      if (aiResponse.mediaToSend && aiResponse.mediaToSend.length > 0) {
        // Verificar que el audio esté habilitado antes de enviar audio
        const botConfig = await this.prisma.botConfig.findUnique({
          where: { businessId },
        });

        for (const media of aiResponse.mediaToSend) {
          try {
            // Verificar si es audio y si está habilitado
            if (media.type === 'audio' && !(botConfig as any)?.audioEnabled) {
              console.log('Audio sending is disabled, skipping audio media');
              continue;
            }

            if (media.type === 'image') {
              if (media.fileId) {
                await this.sendImageFromFile(businessId, fromJid, media.fileId, undefined, media.caption);
              } else if (media.filePath) {
                await this.sendImageFromFile(businessId, fromJid, undefined, media.filePath, media.caption);
              }
            } else if (media.type === 'video') {
              if (media.fileId) {
                await this.sendVideoFromFile(businessId, fromJid, media.fileId, undefined, media.caption);
              } else if (media.filePath) {
                await this.sendVideoFromFile(businessId, fromJid, undefined, media.filePath, media.caption);
              }
            } else if (media.type === 'document') {
              if (media.fileId) {
                await this.sendDocumentFromFile(businessId, fromJid, media.fileId, undefined, media.caption);
              } else if (media.filePath) {
                await this.sendDocumentFromFile(businessId, fromJid, undefined, media.filePath, media.caption);
              }
            } else if (media.type === 'audio') {
              if (media.fileId) {
                await this.sendAudioFromFile(businessId, fromJid, media.fileId, undefined, false);
              } else if (media.filePath) {
                await this.sendAudioFromFile(businessId, fromJid, undefined, media.filePath, false);
              }
            }
          } catch (mediaError: any) {
            console.error(`Error sending ${media.type}:`, mediaError);
            // Continuar con otros medios aunque uno falle
          }
        }
      }

      // Create outbound message
      await this.prisma.message.create({
        data: {
          businessId,
          direction: 'OUTBOUND',
          content: aiResponse.message,
          from: '', // own number
          to: from, // Guardar sin @s.whatsapp.net en BD
          status: 'SENT',
          aiResponse: true,
          aiConfidence: aiResponse.confidence,
          processingTime: aiResponse.processingTime,
          metadata: aiResponse.mediaToSend ? { mediaSent: aiResponse.mediaToSend.length } : undefined,
        } as any,
      });
    } catch (error: any) {
      console.error('Error generating AI response:', error);
      
      // Detectar errores específicos y enviar mensajes apropiados
      let errorMessage = 'Lo siento, hubo un error al procesar tu mensaje. Por favor, intenta nuevamente en unos momentos.';
      
      if (error?.status === 429 || error?.message?.includes('quota') || error?.message?.includes('Too Many Requests')) {
        errorMessage = 'Lo siento, he alcanzado el límite de solicitudes por minuto. Por favor, espera unos segundos y vuelve a intentar.';
      } else if (error?.status === 404 || error?.message?.includes('model') && error?.message?.includes('does not exist')) {
        errorMessage = 'Error de configuración: El modelo de IA no es válido. Por favor, contacta al administrador para corregir la configuración.';
        console.error('Model not found error. The configured model is not valid for the selected AI provider.');
      } else if (error?.message?.includes('API key') || error?.message?.includes('authentication') || error?.status === 401) {
        errorMessage = 'Error de configuración de la IA. Por favor, contacta al administrador.';
      }
      
      // Enviar mensaje de error al usuario (usar fromJid)
      try {
        await this.sendMessage(businessId, fromJid, errorMessage);
      } catch (sendError: any) {
        console.error('Error sending error message to user:', sendError);
        // No crashear si falla el envío del mensaje de error
      }
      // Log del error pero no crashear el proceso
      if (error.status === 401 || error.code === 'invalid_api_key') {
        console.error('AI API key is invalid. Please check your API key configuration.');
      }
    }
  }

  /**
   * Maneja llamadas entrantes rechazándolas y enviando una respuesta automática
   */
  private async handleCall(businessId: string, call: any) {
    const fromJid = call.from;
    const sock = this.sockets.get(businessId);
    if (!sock) return;

    console.log(`[WhatsApp Web] Rechazando llamada de ${fromJid}...`);
    
    try {
      // --- PLAN CHECK: Call Handling ---
      const hasCallHandling = await this.planService.hasFeatureAccess(businessId, 'hasCallHandling');
      if (!hasCallHandling) {
        console.log(`[WhatsApp Web] Call Handling NOT allowed for businessId: ${businessId}. Just rejecting.`);
        await sock.rejectCall(call.id, fromJid);
        return;
      }

      // Rechazar llamada
      await sock.rejectCall(call.id, fromJid);
      
      const botConfig = await this.prisma.botConfig.findUnique({
        where: { businessId },
        select: { audioEnabled: true, callEnabled: true } as any,
      });

      if (!botConfig) return;

      const message = "Hola, soy un asistente virtual y no puedo contestar llamadas en este momento. Por favor, envíame un mensaje de texto o una nota de voz y te ayudaré de inmediato.";

      if ((botConfig as any).audioEnabled) {
        // Enviar respuesta de voz
        const audioBuffer = await this.ttsService.generateSpeechBuffer(message);
        if (audioBuffer) {
          await sock.sendMessage(fromJid, {
            audio: audioBuffer,
            mimetype: 'audio/mp4',
            ptt: true,
          });
        }
      } else {
        // Enviar respuesta de texto
        await this.sendMessage(businessId, fromJid, message);
      }
    } catch (error) {
      console.error(`[WhatsApp Web] Error al manejar llamada de ${fromJid}:`, error);
    }
  }
}
