import { Injectable, BadRequestException, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { UpdateBotConfigDto } from './dto/update-bot-config.dto';
import { TestBotConfigDto } from './dto/test-bot-config.dto';
import { Business } from '@prisma/client';

@Injectable()
export class BotConfigService {
  private readonly logger = new Logger(BotConfigService.name);

  constructor(private readonly prisma: PrismaService) {}

  async findByBusinessId(businessId: string) {
    try {
      return await this.prisma.botConfig.findUnique({
        where: { businessId },
        include: {
          business: true,
        },
      });
    } catch (error) {
      this.logger.error('Error finding bot config by business ID:', error);
      throw error;
    }
  }

  async createDefaultConfig(businessId: string) {
    try {
      // Get business info to customize default config
      const business = await this.prisma.business.findUnique({
        where: { id: businessId },
      });

      if (!business) {
        throw new NotFoundException('Business not found');
      }

      const defaultConfig = this.getDefaultConfigForIndustry(business.industryType, business.name);
      
      return await this.prisma.botConfig.create({
        data: {
          businessId,
          ...defaultConfig,
        },
        include: {
          business: true,
        },
      });
    } catch (error) {
      this.logger.error('Error creating default bot config:', error);
      throw error;
    }
  }

  async updateBotConfig(businessId: string, updateBotConfigDto: UpdateBotConfigDto) {
    try {
      // Check if bot config exists
      const existingConfig = await this.findByBusinessId(businessId);
      if (!existingConfig) {
        throw new NotFoundException('Bot configuration not found');
      }

      const updatedConfig = await this.prisma.botConfig.update({
        where: { businessId },
        data: {
          ...updateBotConfigDto,
          updatedAt: new Date(),
        },
        include: {
          business: true,
        },
      });

      this.logger.log(`Bot configuration updated for business: ${businessId}`);
      return updatedConfig;
    } catch (error) {
      this.logger.error('Error updating bot config:', error);
      throw error;
    }
  }

  async testBotConfig(businessId: string, testBotConfigDto: TestBotConfigDto) {
    try {
      const botConfig = await this.findByBusinessId(businessId);
      if (!botConfig) {
        throw new NotFoundException('Bot configuration not found');
      }

      // Simulate bot testing
      const testResults = {
        config: {
          welcomeMessage: testBotConfigDto.welcomeMessage || botConfig.welcomeMessage,
          fallbackMessage: testBotConfigDto.fallbackMessage || botConfig.fallbackMessage,
          autoReply: testBotConfigDto.autoReply ?? botConfig.autoReply,
        },
        testMessage: testBotConfigDto.testMessage || 'Hola, ¿qué servicios ofrecen?',
        response: this.generateTestResponse(testBotConfigDto.testMessage || 'Hola, ¿qué servicios ofrecen?', botConfig.business.industryType),
        timestamp: new Date(),
        status: 'success',
        responseTime: Math.floor(Math.random() * 500) + 100, // Random response time between 100-600ms
      };

      return testResults;
    } catch (error) {
      this.logger.error('Error testing bot config:', error);
      throw error;
    }
  }

  async resetBotConfig(businessId: string) {
    try {
      const business = await this.prisma.business.findUnique({
        where: { id: businessId },
      });

      if (!business) {
        throw new NotFoundException('Business not found');
      }

      const defaultConfig = this.getDefaultConfigForIndustry(business.industryType, business.name);

      const resetConfig = await this.prisma.botConfig.update({
        where: { businessId },
        data: {
          ...defaultConfig,
          updatedAt: new Date(),
        },
        include: {
          business: true,
        },
      });

      this.logger.log(`Bot configuration reset for business: ${businessId}`);
      return resetConfig;
    } catch (error) {
      this.logger.error('Error resetting bot config:', error);
      throw error;
    }
  }

  async activateBot(businessId: string) {
    try {
      const activatedConfig = await this.prisma.botConfig.update({
        where: { businessId },
        data: {
          isActive: true,
          updatedAt: new Date(),
        },
        include: {
          business: true,
        },
      });

      this.logger.log(`Bot activated for business: ${businessId}`);
      return activatedConfig;
    } catch (error) {
      this.logger.error('Error activating bot:', error);
      throw error;
    }
  }

  async deactivateBot(businessId: string) {
    try {
      const deactivatedConfig = await this.prisma.botConfig.update({
        where: { businessId },
        data: {
          isActive: false,
          updatedAt: new Date(),
        },
        include: {
          business: true,
        },
      });

      this.logger.log(`Bot deactivated for business: ${businessId}`);
      return deactivatedConfig;
    } catch (error) {
      this.logger.error('Error deactivating bot:', error);
      throw error;
    }
  }

  async getBotLogs(businessId: string) {
    try {
      // In a real implementation, this would fetch from a logs table
      // For now, return mock logs
      const mockLogs = [
        {
          id: '1',
          level: 'info',
          message: 'Bot initialized successfully',
          timestamp: new Date(Date.now() - 3600000),
          businessId,
        },
        {
          id: '2',
          level: 'info',
          message: 'Received message from customer',
          timestamp: new Date(Date.now() - 1800000),
          businessId,
        },
        {
          id: '3',
          level: 'info',
          message: 'Bot response sent successfully',
          timestamp: new Date(Date.now() - 900000),
          businessId,
        },
      ];

      return mockLogs;
    } catch (error) {
      this.logger.error('Error getting bot logs:', error);
      throw error;
    }
  }

  async getBotStats(businessId: string) {
    try {
      const botConfig = await this.findByBusinessId(businessId);
      if (!botConfig) {
        throw new NotFoundException('Bot configuration not found');
      }

      // Get mock statistics
      const stats = {
        totalMessages: Math.floor(Math.random() * 1000) + 100,
        activeConversations: Math.floor(Math.random() * 50) + 10,
        avgResponseTime: Math.floor(Math.random() * 300) + 100,
        satisfactionRate: Math.floor(Math.random() * 30) + 70, // 70-100%
        uptime: Math.floor(Math.random() * 5) + 95, // 95-100%
        lastActivity: new Date(Date.now() - Math.floor(Math.random() * 3600000)),
        isActive: botConfig.isActive,
        configVersion: botConfig.updatedAt,
      };

      return stats;
    } catch (error) {
      this.logger.error('Error getting bot stats:', error);
      throw error;
    }
  }

  async exportBotConfig(businessId: string) {
    try {
      const botConfig = await this.findByBusinessId(businessId);
      if (!botConfig) {
        throw new NotFoundException('Bot configuration not found');
      }

      // Remove sensitive information and prepare for export
      const exportData = {
        businessId: botConfig.businessId,
        businessName: botConfig.business.name,
        industryType: botConfig.business.industryType,
        config: {
          welcomeMessage: botConfig.welcomeMessage,
          fallbackMessage: botConfig.fallbackMessage,
          autoReply: botConfig.autoReply,
          businessHours: botConfig.businessHours,
          customPrompt: botConfig.customPrompt,
          temperature: botConfig.temperature,
          maxTokens: botConfig.maxTokens,
        },
        exportedAt: new Date(),
        version: '1.0',
      };

      return exportData;
    } catch (error) {
      this.logger.error('Error exporting bot config:', error);
      throw error;
    }
  }

  async importBotConfig(businessId: string, importData: any) {
    try {
      // Validate import data
      if (!importData.config) {
        throw new BadRequestException('Invalid import data: missing config');
      }

      const business = await this.prisma.business.findUnique({
        where: { id: businessId },
      });

      if (!business) {
        throw new NotFoundException('Business not found');
      }

      // Update bot config with imported data
      const importedConfig = await this.prisma.botConfig.update({
        where: { businessId },
        data: {
          ...importData.config,
          updatedAt: new Date(),
        },
        include: {
          business: true,
        },
      });

      this.logger.log(`Bot configuration imported for business: ${businessId}`);
      return importedConfig;
    } catch (error) {
      this.logger.error('Error importing bot config:', error);
      throw error;
    }
  }

  async verifyBusinessAccess(userId: string, businessId: string): Promise<boolean> {
    try {
      const business = await this.prisma.business.findFirst({
        where: {
          id: businessId,
          ownerId: userId,
        },
      });

      return !!business;
    } catch (error) {
      this.logger.error('Error verifying business access:', error);
      return false;
    }
  }

  private getDefaultConfigForIndustry(industryType: string, businessName: string) {
    const configs = {
      RESTAURANT: {
        welcomeMessage: `🍽️ *${businessName}*\n\n¡Bienvenido! Estoy aquí para ayudarte con:\n• 🍕 Pedidos y delivery\n• 📅 Reservas de mesa\n• 📋 Menú y precios\n• 🕐 Horarios de atención\n\n¿En qué puedo ayudarte hoy?`,
        fallbackMessage: 'Lo siento, no entendí eso. Por favor, elige una opción del menú o escribe "ayuda" para ver las opciones disponibles.',
        autoReply: true,
        businessHours: {
          monday: { open: '11:00', close: '23:00' },
          tuesday: { open: '11:00', close: '23:00' },
          wednesday: { open: '11:00', close: '23:00' },
          thursday: { open: '11:00', close: '23:00' },
          friday: { open: '11:00', close: '00:00' },
          saturday: { open: '11:00', close: '00:00' },
          sunday: { open: '12:00', close: '22:00' },
        },
        customPrompt: 'Eres un asistente amigable para un restaurante. Ayuda a los clientes con pedidos, reservas y información del menú.',
        temperature: 0.7,
        maxTokens: 500,
        isActive: true,
      },
      CLINIC: {
        welcomeMessage: `🏥 *${businessName}*\n\n¡Bienvenido! Estoy aquí para ayudarte con:\n• 📅 Agendar citas médicas\n• 💊 Consultas de farmacia\n• 🕐 Horarios de atención\n• 📞 Información de contacto\n\n¿En qué puedo ayudarte hoy?`,
        fallbackMessage: 'Lo siento, no entendí eso. Por favor, elige una opción del menú o escribe "ayuda" para ver las opciones disponibles.',
        autoReply: true,
        businessHours: {
          monday: { open: '08:00', close: '20:00' },
          tuesday: { open: '08:00', close: '20:00' },
          wednesday: { open: '08:00', close: '20:00' },
          thursday: { open: '08:00', close: '20:00' },
          friday: { open: '08:00', close: '20:00' },
          saturday: { open: '09:00', close: '14:00' },
          sunday: { open: 'closed' },
        },
        customPrompt: 'Eres un asistente profesional para una clínica médica. Ayuda a los pacientes con agendamiento de citas y consultas médicas.',
        temperature: 0.5,
        maxTokens: 400,
        isActive: true,
      },
      REAL_ESTATE: {
        welcomeMessage: `🏠 *${businessName}*\n\n¡Bienvenido! Estoy aquí para ayudarte con:\n• 🏘️ Catálogo de propiedades\n• 📅 Agendar tours virtuales\n• 📊 Información de precios\n• 📍 Ubicaciones disponibles\n\n¿Qué tipo de propiedad buscas?`,
        fallbackMessage: 'Lo siento, no entendí eso. Por favor, elige una opción del menú o escribe "ayuda" para ver las opciones disponibles.',
        autoReply: true,
        businessHours: {
          monday: { open: '09:00', close: '19:00' },
          tuesday: { open: '09:00', close: '19:00' },
          wednesday: { open: '09:00', close: '19:00' },
          thursday: { open: '09:00', close: '19:00' },
          friday: { open: '09:00', close: '19:00' },
          saturday: { open: '10:00', close: '16:00' },
          sunday: { open: 'closed' },
        },
        customPrompt: 'Eres un asistente inmobiliario. Ayuda a los clientes a encontrar propiedades y agendar visitas.',
        temperature: 0.6,
        maxTokens: 450,
        isActive: true,
      },
      ACADEMY: {
        welcomeMessage: `📚 *${businessName}*\n\n¡Bienvenido! Estoy aquí para ayudarte con:\n• 📖 Cursos disponibles\n• 📅 Inscripciones\n• 💰 Precios y promociones\n• 🕐 Horarios de clases\n\n¿Qué curso te interesa?`,
        fallbackMessage: 'Lo siento, no entendí eso. Por favor, elige una opción del menú o escribe "ayuda" para ver las opciones disponibles.',
        autoReply: true,
        businessHours: {
          monday: { open: '08:00', close: '22:00' },
          tuesday: { open: '08:00', close: '22:00' },
          wednesday: { open: '08:00', close: '22:00' },
          thursday: { open: '08:00', close: '22:00' },
          friday: { open: '08:00', close: '22:00' },
          saturday: { open: '09:00', close: '18:00' },
          sunday: { open: '10:00', close: '14:00' },
        },
        customPrompt: 'Eres un asistente educativo. Ayuda a los estudiantes con información sobre cursos e inscripciones.',
        temperature: 0.6,
        maxTokens: 400,
        isActive: true,
      },
      RETAIL: {
        welcomeMessage: `🛍️ *${businessName}*\n\n¡Bienvenido! Estoy aquí para ayudarte con:\n• 🛒 Catálogo de productos\n• 📦 Pedidos y delivery\n• 💰 Ofertas y promociones\n• 📞 Contacto y soporte\n\n¿Qué producto buscas?`,
        fallbackMessage: 'Lo siento, no entendí eso. Por favor, elige una opción del menú o escribe "ayuda" para ver las opciones disponibles.',
        autoReply: true,
        businessHours: {
          monday: { open: '10:00', close: '21:00' },
          tuesday: { open: '10:00', close: '21:00' },
          wednesday: { open: '10:00', close: '21:00' },
          thursday: { open: '10:00', close: '21:00' },
          friday: { open: '10:00', close: '21:00' },
          saturday: { open: '10:00', close: '22:00' },
          sunday: { open: '11:00', close: '20:00' },
        },
        customPrompt: 'Eres un asistente de ventas. Ayuda a los clientes con productos, pedidos y promociones.',
        temperature: 0.7,
        maxTokens: 500,
        isActive: true,
      },
      SERVICES: {
        welcomeMessage: `🔧 *${businessName}*\n\n¡Bienvenido! Estoy aquí para ayudarte con:\n• 🛠️ Servicios disponibles\n• 📅 Agendar citas\n• 💰 Cotizaciones\n• 📞 Contacto y soporte\n\n¿Qué servicio necesitas?`,
        fallbackMessage: 'Lo siento, no entendí eso. Por favor, elige una opción del menú o escribe "ayuda" para ver las opciones disponibles.',
        autoReply: true,
        businessHours: {
          monday: { open: '08:00', close: '18:00' },
          tuesday: { open: '08:00', close: '18:00' },
          wednesday: { open: '08:00', close: '18:00' },
          thursday: { open: '08:00', close: '18:00' },
          friday: { open: '08:00', close: '18:00' },
          saturday: { open: '09:00', close: '14:00' },
          sunday: { open: 'closed' },
        },
        customPrompt: 'Eres un asistente de servicios profesionales. Ayuda a los clientes con agendamiento y cotizaciones.',
        temperature: 0.6,
        maxTokens: 450,
        isActive: true,
      },
    };

    return configs[industryType] || configs.SERVICES;
  }

  private generateTestResponse(testMessage: string, industryType: string): string {
    const responses = {
      RESTAURANT: 'Gracias por tu mensaje. Puedo ayudarte con pedidos, reservas o información del menú. ¿Qué necesitas?',
      CLINIC: 'Hola! Soy el asistente de la clínica. Puedo ayudarte a agendar una cita o responder tus consultas médicas.',
      REAL_ESTATE: '¡Hola! Estoy aquí para ayudarte a encontrar la propiedad perfecta. ¿Qué tipo de inmueble buscas?',
      ACADEMY: 'Bienvenido a nuestra academia. Puedo informarte sobre nuestros cursos y ayudarte con tu inscripción.',
      RETAIL: '¡Hola! Estoy para ayudarte con tus compras. ¿Qué producto te interesa o necesitas ayuda con algo específico?',
      SERVICES: 'Hola! Soy tu asistente de servicios. ¿En qué puedo ayudarte hoy?',
    };

    return responses[industryType] || responses.SERVICES;
  }
}
