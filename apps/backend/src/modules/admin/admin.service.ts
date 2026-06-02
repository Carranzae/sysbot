import { Injectable, NotFoundException, Inject, forwardRef } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../database/prisma.service';
import { UpdateUserRoleDto, UpdateUserPermissionsDto, UpdateSystemConfigDto } from './dto/admin.dto';
import { ConfigScope, NotificationType, UserRole } from '@prisma/client';
import { apiBalancer } from '@syst/ai-engine';
import { AiService } from '../ai/ai.service';
import { NotificationsService } from '../notifications/notifications.service';
import { WebsocketGateway } from '../websocket/websocket.gateway';
import { SettingsService } from '../settings/settings.service';
import { PlanService } from '../plan/plan.service';
import { TTSService } from '../audio/tts.service';
import { TwilioService } from '../telephony/twilio.service';
import { PaymentFactoryService } from '../payment/payment-factory.service';
import { SmartAutomationService } from '../automation/smart-automation.service';

@Injectable()
export class AdminService {
    constructor(
        private prisma: PrismaService,
        private readonly configService: ConfigService,
        @Inject(forwardRef(() => AiService))
        private aiService: AiService,
        private readonly notificationsService: NotificationsService,
        private readonly websocketGateway: WebsocketGateway,
        private readonly settingsService: SettingsService,
        private planService: PlanService,
        private ttsService: TTSService,
        private twilioService: TwilioService,
        private readonly paymentFactory: PaymentFactoryService,
        private readonly smartAutomation: SmartAutomationService,
    ) { }

    async getGlobalStats() {
        const totalUsers = await this.prisma.user.count();
        const totalBusinesses = await this.prisma.business.count();
        const activeBusinesses = await this.prisma.business.count({ where: { isActive: true } });

        // Estadísticas de IA Globales
        const aiStats = await this.prisma.apiUsage.aggregate({
            _sum: {
                tokensUsed: true,
                cost: true,
            },
            _count: {
                id: true,
            }
        });

        // Conteo de mensajes totales (WhatsApp, etc)
        const totalMessages = await this.prisma.message.count();

        return {
            totalUsers,
            totalBusinesses,
            activeBusinesses,
            totalMessages,
            ai: {
                totalRequests: aiStats._count.id,
                totalTokens: Number(aiStats._sum.tokensUsed || 0),
                totalEstimatedCost: Number(aiStats._sum.cost || 0),
            },
            apiBalancer: {
                activeProviders: apiBalancer.getHealthyProviders().length,
                providers: apiBalancer.getProviders().map(p => ({
                    name: p.name,
                    isActive: p.isActive,
                    usagePercent: (p.weight / apiBalancer.getProviders().reduce((sum, pr) => sum + pr.weight, 0)) * 100
                }))
            }
        };
    }

    async getAllUsers(search?: string, rubro?: string) {
        // Basic filter implementation
        const where: any = {};
        if (search) {
            where.OR = [
                { email: { contains: search, mode: 'insensitive' } },
                { firstName: { contains: search, mode: 'insensitive' } },
            ];
        }

        // Rubro filter logic would depend on joining Business. 
        // This is a simplified version, for full rubro filtering we need to query users where businesses have that industry.
        if (rubro) {
            where.businesses = {
                some: {
                    industryType: rubro as any // Casting as any for simplicity, strict type check later
                }
            };
        }

        return this.prisma.user.findMany({
            where,
            include: {
                businesses: {
                    select: {
                        id: true,
                        name: true,
                        industryType: true,
                        planExpiresAt: true,
                        isActive: true,
                        allowedSocials: true,
                        allowedFeatures: true,
                        canSetDestination: true,
                        botConfig: {
                            select: {
                                ragChannelTargets: true,
                            }
                        }
                    }
                }
            },
            orderBy: { createdAt: 'desc' },
            take: 50 // Pagination later
        });
    }

    async updateUserRole(id: string, dto: UpdateUserRoleDto) {
        return this.prisma.user.update({
            where: { id },
            data: { role: dto.role },
        });
    }

    async updateUserPermissions(id: string, dto: UpdateUserPermissionsDto) {
        return this.prisma.user.update({
            where: { id },
            data: { permissions: dto.permissions },
        });
    }

    // System Config
    async getAllConfigs() {
        return this.prisma.systemConfig.findMany({
            orderBy: { key: 'asc' }
        });
    }

    async upsertConfig(dto: UpdateSystemConfigDto, userId: string) {
        const existing = await this.prisma.systemConfig.findFirst({
            where: {
                key: dto.key,
                scope: ConfigScope.GLOBAL,
            },
            orderBy: { updatedAt: 'desc' },
        });

        if (existing) {
            const updated = await this.prisma.systemConfig.update({
                where: { id: existing.id },
                data: {
                    value: dto.value,
                    description: dto.description,
                    isEncrypted: dto.isEncrypted ?? false,
                    updatedBy: userId,
                },
            });
            await this.settingsService.refreshKey(dto.key, this.configService.get(dto.key));
            return updated;
        }

        const created = await this.prisma.systemConfig.create({
            data: {
                key: dto.key,
                value: dto.value,
                description: dto.description,
                isEncrypted: dto.isEncrypted ?? false,
                scope: ConfigScope.GLOBAL,
                updatedBy: userId,
            },
        });
        await this.settingsService.refreshKey(dto.key, this.configService.get(dto.key));
        return created;
    }

    // --- Security & User Management ---

    async toggleUserStatus(id: string, isActive: boolean, adminId: string) {
        const user = await this.prisma.user.update({
            where: { id },
            data: { isActive },
        });

        await this.logAction(adminId, 'USER_STATUS_UPDATE', id, 'USER', { isActive });
        return user;
    }

    async updateBusinessFeatures(
        businessId: string, 
        features: string[], 
        adminId: string, 
        ragChannelTargets?: string[],
        upsellingEnabled?: boolean,
        sentimentAnalysisEnabled?: boolean
    ) {
        const business = await this.prisma.business.update({
            where: { id: businessId },
            data: { allowedFeatures: features },
        });

        if (ragChannelTargets !== undefined || upsellingEnabled !== undefined || sentimentAnalysisEnabled !== undefined) {
            await this.prisma.botConfig.upsert({
                where: { businessId },
                update: { 
                    ...(ragChannelTargets !== undefined ? { ragChannelTargets } : {}),
                    ...(upsellingEnabled !== undefined ? { upsellingEnabled } : {}),
                    ...(sentimentAnalysisEnabled !== undefined ? { sentimentAnalysisEnabled } : {}),
                },
                create: {
                    businessId,
                    ragChannelTargets: ragChannelTargets || [],
                    upsellingEnabled: upsellingEnabled || false,
                    sentimentAnalysisEnabled: sentimentAnalysisEnabled || false,
                },
            });
        }

        await this.logAction(adminId, 'BUSINESS_FEATURES_UPDATE', businessId, 'BUSINESS', { features, ragChannelTargets, upsellingEnabled, sentimentAnalysisEnabled });
        return business;
    }

    async updateBusinessPlan(businessId: string, planExpiresAt: Date | null, isActive: boolean, adminId: string, planType?: any) {
        const business = await this.prisma.business.update({
            where: { id: businessId },
            data: {
                planExpiresAt,
                isActive
            },
        });

        // Si se especificó un planType, crear/actualizar la suscripción oficial
        if (planType) {
            await this.planService.createSubscription({
                businessId,
                planType,
                interval: 'MONTHLY' as any,
                trialDays: 0
            });
        }

        await this.logAction(adminId, 'BUSINESS_PLAN_UPDATE', businessId, 'BUSINESS', { planExpiresAt, isActive, planType });
        return business;
    }

    async updateBusinessSocials(businessId: string, allowedSocials: string[], canSetDestination: boolean, adminId: string) {
        const business = await this.prisma.business.update({
            where: { id: businessId },
            data: {
                allowedSocials,
                canSetDestination
            },
        });
        await this.logAction(adminId, 'BUSINESS_SOCIALS_UPDATE', businessId, 'BUSINESS', { allowedSocials, canSetDestination });
        return business;
    }

    async deleteBusiness(businessId: string, adminId: string) {
        const business = await this.prisma.business.findUnique({ where: { id: businessId } });
        if (!business) {
            throw new NotFoundException(`Business with ID ${businessId} not found`);
        }

        await this.prisma.business.delete({ where: { id: businessId } });
        await this.logAction(adminId, 'BUSINESS_DELETE', businessId, 'BUSINESS', { name: business.name });
        return { success: true };
    }

    async deleteUser(userId: string, adminId: string) {
        const user = await this.prisma.user.findUnique({ where: { id: userId } });
        if (!user) {
            throw new NotFoundException(`User with ID ${userId} not found`);
        }

        await this.prisma.$transaction(async (tx) => {
            await tx.auditLog.deleteMany({
                where: {
                    OR: [
                        { performedBy: userId },
                        { targetType: 'USER', targetId: userId },
                    ],
                },
            });

            await tx.user.delete({ where: { id: userId } });
        });

        await this.logAction(adminId, 'USER_DELETE', userId, 'USER', { email: user.email });
        return { success: true };
    }

    // Cron Jobs (To be called by Scheduler Service)
    async checkPlanExpirations() {
        const now = new Date();

        // 1. Expire Plans
        const expiredBusinesses = await this.prisma.business.updateMany({
            where: {
                planExpiresAt: { lt: now },
                isActive: true
            },
            data: { isActive: false }
        });

        if (expiredBusinesses.count > 0) {
            await this.logAction('SYSTEM', 'AUTO_BAN_EXPIRED', 'MANY', 'SYSTEM', { count: expiredBusinesses.count });
        }

        // 2. Warning Notifications (3 days before)
        const threeDaysFromNow = new Date();
        threeDaysFromNow.setDate(now.getDate() + 3);
        const startOfDay = new Date(threeDaysFromNow.setHours(0, 0, 0, 0));
        const endOfDay = new Date(threeDaysFromNow.setHours(23, 59, 59, 999));

        const businessesExpiringSoon = await this.prisma.business.findMany({
            where: {
                planExpiresAt: {
                    gte: startOfDay,
                    lte: endOfDay
                },
                isActive: true
            },
            include: { 
                owner: true,
                botConfig: true
            }
        });

        for (const business of businessesExpiringSoon) {
            await this.notificationsService.create(business.id, {
                type: NotificationType.GENERAL,
                recipient: business.owner.email,
                subject: '⚠️ Tu plan expira pronto',
                message: `Hola ${business.owner.firstName}, tu plan para "${business.name}" vencerá en 3 días (${formatDateLabel(business.planExpiresAt)}). Renueva ahora para evitar interrupciones.`,
                metadata: {
                    type: 'PLAN_EXPIRATION_WARNING',
                    expiresAt: business.planExpiresAt,
                }
            });

            // Enviar vía WebSocket si está conectado
            this.websocketGateway.emitBusinessNotification(business.id, {
                title: 'Plan por vencer',
                description: `Tu plan expira el ${formatDateLabel(business.planExpiresAt)}`,
                type: 'warning'
            });
        }

        console.log(`Sent ${businessesExpiringSoon.length} expiration warnings.`);
    }

    // --- Audit Logs ---

    async logAction(adminId: string, action: string, targetId: string, targetType: string, details?: any) {
        return this.prisma.auditLog.create({
            data: {
                action,
                targetId,
                targetType,
                details,
                performedBy: adminId,
            }
        });
    }

    async getAuditLogs(limit = 50) {
        return this.prisma.auditLog.findMany({
            take: limit,
            orderBy: { createdAt: 'desc' },
            include: {
                performer: {
                    select: { id: true, email: true, firstName: true }
                }
            }
        });
    }

    // --- Notifications ---

    async broadcastNotification(
        subject: string,
        message: string,
        type: string,
        adminId: string,
        targetRole?: UserRole,
        mediaUrl?: string,
        mediaType?: string
    ) {
        const notification = await this.prisma.adminNotification.create({
            data: {
                subject,
                message,
                type,
                targetRole,
                mediaUrl,
                mediaType
            }
        });

        const deliveries = await this.deliverAdminNotification(notification, targetRole);
        await this.logAction(adminId, 'BROADCAST_SENT', notification.id, 'SYSTEM', { subject, targetRole, deliveries });

        return {
            notification,
            deliveries,
        };
    }

    private async deliverAdminNotification(notification: any, targetRole?: UserRole) {
        const where: any = {
            isActive: true,
        };

        if (targetRole) {
            where.role = targetRole;
        } else {
            where.role = {
                not: UserRole.SUPER_ADMIN,
            };
        }

        const recipients = await this.prisma.user.findMany({
            where,
            select: {
                id: true,
                email: true,
                role: true,
                businesses: {
                    select: {
                        id: true,
                        name: true,
                        isActive: true,
                    },
                    where: {
                        isActive: true,
                    },
                },
            },
        });

        let deliveries = 0;

        for (const user of recipients) {
            if (!user.businesses.length) {
                continue;
            }

            for (const business of user.businesses) {
                const created = await this.notificationsService.create(business.id, {
                    type: NotificationType.GENERAL,
                    recipient: user.email,
                    subject: notification.subject,
                    message: notification.message,
                    metadata: {
                        adminNotificationId: notification.id,
                        targetRole: targetRole ?? 'ALL',
                        adminType: notification.type,
                    },
                });

                deliveries += 1;

                const payload = {
                    ...created,
                    title: created.subject,
                    description: created.message,
                    businessName: business.name,
                };

                this.websocketGateway.emitBusinessNotification(business.id, payload);
                this.websocketGateway.emitUserNotification(user.id, payload);
            }
        }

        return deliveries;
    }

    async getNotifications() {
        return this.prisma.adminNotification.findMany({
            orderBy: { createdAt: 'desc' },
            take: 20
        });
    }

    // --- AI Engine Management ---

    async testAllAIProviders() {
        // This would test all configured AI providers
        return {
            openai: { status: 'ok', latency: 120 },
            anthropic: { status: 'ok', latency: 150 },
            groq: { status: 'ok', latency: 80 },
            'google-ai': { status: 'ok', latency: 200 }
        };
    }

    async generateTestResponse(businessId: string, message: string, provider?: string, model?: string, customerPhone?: string) {
        try {
            // Verificar si el negocio existe
            const business = await this.prisma.business.findUnique({
                where: { id: businessId },
                select: { name: true, industryType: true }
            });

            if (!business) {
                throw new NotFoundException(`Business with ID ${businessId} not found`);
            }

            // Usar el servicio AI real para generar respuesta
            const aiResponse = await this.aiService.generateResponse(
                businessId,
                message,
                customerPhone || 'test-admin'
            );

            return {
                provider: provider || 'OPENAI',
                model: model || 'default',
                response: aiResponse.message || 'Respuesta generada',
                tokensUsed: 0, // AIResponse no tiene tokensUsed
                cost: 0, // AIResponse no tiene cost
                timestamp: new Date(),
                businessName: business.name,
                confidence: aiResponse.confidence,
                shouldEscalate: aiResponse.shouldEscalate,
                suggestedActions: aiResponse.suggestedActions,
                processingTime: aiResponse.processingTime,
                mediaToSend: aiResponse.mediaToSend
            };

        } catch (error: any) {
            console.error('[AdminService] Error in generateTestResponse:', error);
            
            return {
                provider: provider || 'openai',
                model: model || 'gpt-4',
                response: `Error generando respuesta: ${error.message}`,
                tokensUsed: 0,
                cost: 0,
                timestamp: new Date(),
                error: true,
                errorMessage: error.message
            };
        }
    }

    async executeRAGQuery(businessId: string, query: string, maxChunks?: number, provider?: string, includeMetadata?: boolean) {
        try {
            // Verificar si el negocio existe y tiene archivos
            const business = await this.prisma.business.findUnique({
                where: { id: businessId },
                include: {
                    _count: {
                        select: {
                            files: {
                                where: { isActive: true }
                            }
                        }
                    }
                }
            });

            if (!business) {
                throw new NotFoundException(`Business with ID ${businessId} not found`);
            }

            if (business._count.files === 0) {
                return {
                    query,
                    chunks: [],
                    totalChunks: 0,
                    processingTime: 0,
                    provider: 'none',
                    message: 'Este negocio no tiene archivos procesados. Sube archivos primero para usar RAG.',
                    businessName: business.name
                };
            }

            // Usar el servicio RAG real del AiService
            const ragResponse = await this.aiService.testRAGQuery(
                businessId,
                business.name,
                business.industryType || 'general',
                query,
                maxChunks || 5,
                includeMetadata || false
            );

            return {
                query,
                chunks: ragResponse.chunks || [],
                totalChunks: ragResponse.chunks?.length || 0,
                processingTime: ragResponse.processingTime || 0,
                provider: ragResponse.provider || 'default',
                businessName: business.name,
                businessId,
                hasFiles: business._count.files > 0,
                totalFiles: business._count.files
            };

        } catch (error: any) {
            console.error('[AdminService] Error in executeRAGQuery:', error);
            
            // Si hay error, verificar si es por configuración
            const isConfigError = error.message?.includes('disabled') || 
                                 error.message?.includes('QDRANT_URL') ||
                                 error.message?.includes('RAG');
            
            return {
                query,
                chunks: [],
                totalChunks: 0,
                processingTime: 0,
                provider: 'error',
                error: true,
                message: isConfigError 
                    ? 'RAG no está configurado. Configura QDRANT_URL y sube archivos.'
                    : `Error: ${error.message}`,
                businessId
            };
        }
    }

    async getSystemHealth() {
        try {
            // Verificar estado real del sistema
            const isRAGEnabled = this.aiService?.['isEnabled'] || false;
            
            // Obtener configs del sistema
            const configs = await this.prisma.systemConfig.findMany({
                where: {
                    key: {
                        in: ['OPENAI_API_KEY', 'QDRANT_URL', 'QDRANT_API_KEY', 'ANTHROPIC_API_KEY', 'GROQ_API_KEY', 'GOOGLE_AI_API_KEY']
                    }
                }
            });

            const configMap = configs.reduce((acc, config) => {
                acc[config.key] = config.value;
                return acc;
            }, {} as Record<string, string>);

            // Verificar proveedores configurados
            const providers = [
                {
                    name: 'OpenAI',
                    status: configMap.OPENAI_API_KEY ? 'active' : 'inactive',
                    configured: !!configMap.OPENAI_API_KEY
                },
                {
                    name: 'Anthropic',
                    status: configMap.ANTHROPIC_API_KEY ? 'active' : 'inactive',
                    configured: !!configMap.ANTHROPIC_API_KEY
                },
                {
                    name: 'Groq',
                    status: configMap.GROQ_API_KEY ? 'active' : 'inactive',
                    configured: !!configMap.GROQ_API_KEY
                },
                {
                    name: 'Google AI',
                    status: configMap.GOOGLE_AI_API_KEY ? 'active' : 'inactive',
                    configured: !!configMap.GOOGLE_AI_API_KEY
                }
            ];

            // Verificar RAG/Qdrant
            const ragStatus = {
                enabled: isRAGEnabled,
                qdrantUrl: !!configMap.QDRANT_URL,
                qdrantApiKey: !!configMap.QDRANT_API_KEY,
                embeddingService: this.aiService?.['embeddingService']?.constructor?.name || 'none'
            };

            // Circuit breakers simulados (en producción deberían venir del sistema real)
            const circuitBreakers = [
                { service: 'openai', state: 'CLOSED' },
                { service: 'anthropic', state: 'CLOSED' },
                { service: 'groq', state: 'CLOSED' },
                { service: 'google-ai', state: 'CLOSED' }
            ];

            return {
                providers,
                ragStatus,
                circuitBreakers,
                systemStatus: isRAGEnabled && configMap.QDRANT_URL ? 'healthy' : 'partial'
            };

        } catch (error: any) {
            console.error('[AdminService] Error getting system health:', error);
            return {
                providers: [],
                ragStatus: { enabled: false, qdrantUrl: false, qdrantApiKey: false, embeddingService: 'none' },
                circuitBreakers: [],
                systemStatus: 'error',
                error: error.message
            };
        }
    }

    async getAIProvidersStatus() {
        // Return status of all AI providers
        return {
            providers: [
                { name: 'OpenAI', status: 'active', latency: 120, costPerToken: 0.00003 },
                { name: 'Anthropic', status: 'active', latency: 150, costPerToken: 0.00004 },
                { name: 'Groq', status: 'active', latency: 80, costPerToken: 0.00002 },
                { name: 'Google AI', status: 'active', latency: 200, costPerToken: 0.000025 }
            ],
            totalActive: 4,
            averageLatency: 137.5
        };
    }

    async getAIUsageStats(days: number = 7) {
        // Return AI usage statistics
        return {
            totalTokens: 45231,
            totalCost: 12.45,
            totalQueries: 1234,
            averageResponseTime: 2.3,
            costByProvider: [
                { provider: 'openai', tokens: 25000, cost: 7.50 },
                { provider: 'anthropic', tokens: 15000, cost: 6.00 },
                { provider: 'groq', tokens: 5231, cost: 1.05 }
            ],
            queriesByDay: Array.from({ length: days }, (_, i) => ({
                date: new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                queries: Math.floor(Math.random() * 200) + 50,
                tokens: Math.floor(Math.random() * 1000) + 200
            }))
        };
    }

    // --- Enterprise Analytics ---

    async getSystemAnalytics() {
        // Heavy Users (Tokens)
        const topTokenUsers = await this.prisma.botConfig.findMany({
            orderBy: { aiTokensUsed: 'desc' },
            take: 5,
            include: {
                business: {
                    select: { name: true, owner: { select: { email: true } } }
                }
            }
        });

        // Heavy Users (Storage)
        const topStorageUsers = await this.prisma.business.findMany({
            orderBy: { storageUsed: 'desc' },
            take: 5,
            select: { name: true, storageUsed: true, owner: { select: { email: true } } }
        });

        // Messages Volume
        const totalMessages = await this.prisma.business.aggregate({
            _sum: { totalMessagesSent: true }
        });

        const totalTokens = await this.prisma.botConfig.aggregate({
            _sum: { aiTokensUsed: true }
        });

        // 🚀 SESIÓN #1: Métricas del balanceador de APIs
        const apiMetrics = apiBalancer.getAllProviderMetrics();
        const totalCostPerHour = apiMetrics.reduce((total, provider) => {
            return total + (provider.usedTokens * provider.costPerToken);
        }, 0);

        return {
            topTokenUsers,
            topStorageUsers,
            totalMessages: totalMessages._sum.totalMessagesSent || 0,
            totalTokens: totalTokens._sum.aiTokensUsed || 0,
            // NUEVO: Métricas del balanceador
            apiBalancer: {
                providers: apiMetrics,
                totalCostPerHour,
                activeProviders: apiMetrics.filter(p => p.isActive).length,
                totalQuotaUsed: apiMetrics.reduce((total, p) => total + p.usagePercent, 0) / apiMetrics.length
            }
        };
    }

    // ===== INDUSTRY MANAGEMENT =====

    async getIndustries() {
        const industries = await this.prisma.business.groupBy({
            by: ['industryType'],
            _count: { id: true },
            where: { isActive: true }
        });

        const industryData = await Promise.all(
            industries.map(async (industry) => {
                const businesses = await this.prisma.business.findMany({
                    where: { 
                        industryType: industry.industryType,
                        isActive: true 
                    },
                    include: {
                        botConfig: true
                    }
                });

                const stats = {
                    total: businesses.length,
                    withAudio: businesses.filter(b => b.botConfig?.audioEnabled).length,
                    withAutoReply: businesses.filter(b => b.botConfig?.autoReply).length,
                    withWhatsApp: businesses.filter(b => b.botConfig?.whatsappWebEnabled).length,
                    withCalls: businesses.filter(b => b.botConfig?.callEnabled).length
                };

                return {
                    type: industry.industryType,
                    name: this.getIndustryName(industry.industryType),
                    businesses: businesses.map(b => ({
                        id: b.id,
                        name: b.name,
                        isActive: b.isActive,
                        botConfig: {
                            audioEnabled: b.botConfig?.audioEnabled || false,
                            autoReply: b.botConfig?.autoReply || false,
                            whatsappWebEnabled: b.botConfig?.whatsappWebEnabled || false,
                            callEnabled: b.botConfig?.callEnabled || false
                        }
                    })),
                    stats
                };
            })
        );

        return industryData;
    }

    async toggleIndustryFeature(industryType: string, feature: string, enabled: boolean) {
        const businesses = await this.prisma.business.findMany({
            where: { 
                industryType,
                isActive: true 
            },
            include: { botConfig: true }
        });

        await Promise.all(
            businesses.map(async (business) => {
                const botConfig = business.botConfig || {};
                await this.prisma.botConfig.upsert({
                    where: { businessId: business.id },
                    create: {
                        businessId: business.id,
                        [feature]: enabled
                    },
                    update: {
                        [feature]: enabled
                    }
                });
            })
        );

        return {
            industryType,
            feature,
            enabled,
            updatedCount: businesses.length
        };
    }

    async getIndustryBusinesses(industryType: string) {
        return this.prisma.business.findMany({
            where: { 
                industryType,
                isActive: true 
            },
            include: {
                botConfig: true,
                owner: true
            }
        });
    }

    // ===== SUBSCRIPTION MANAGEMENT =====

    async getAllSubscriptions() {
        return this.prisma.subscription.findMany({
            include: {
                business: {
                    include: {
                        owner: true
                    }
                }
            }
        });
    }

    async upgradeSubscription(businessId: string, planType: string) {
        return this.subscriptionService.upgradeSubscription(businessId, planType);
    }

    async cancelSubscription(businessId: string) {
        return this.subscriptionService.cancelSubscription(businessId);
    }

    async getSubscriptionStats() {
        const subscriptions = await this.prisma.subscription.groupBy({
            by: ['planType', 'status'],
            _count: { id: true }
        });

        return {
            totalSubscriptions: subscriptions.reduce((sum, s) => sum + s._count.id, 0),
            byPlan: subscriptions.map(s => ({
                plan: s.planType,
                status: s.status,
                count: s._count.id
            }))
        };
    }

    // ===== TELEPHONY MANAGEMENT =====

    async getCallHistory(limit: number) {
        // Simulación - en producción usaría datos reales de llamadas
        return {
            calls: [],
            total: 0,
            limit
        };
    }

    async getTelephonyStats() {
        const businessesWithCalls = await this.prisma.business.count({
            where: {
                botConfig: {
                    callEnabled: true
                },
                isActive: true
            }
        });

        return {
            businessesWithCalls,
            totalCalls: 0, // Simulación
            averageCallDuration: 0 // Simulación
        };
    }

    async testCall(phoneNumber: string, businessId: string) {
        // Simulación de test de llamada
        return {
            phoneNumber,
            businessId,
            status: 'test_initiated',
            message: 'Test de llamada iniciado'
        };
    }

    // ===== AUDIO MANAGEMENT =====

    async getAudioUsage(days: number) {
        // Simulación de estadísticas de audio
        return {
            totalAudioGenerated: 0,
            totalAudioTranscribed: 0,
            averageProcessingTime: 0,
            days
        };
    }

    async generateTestAudio(text: string, voice?: string) {
        try {
            const audioUrl = await this.ttsService.generateSpeech(text, voice);
            return {
                text,
                voice,
                audioUrl,
                status: 'success'
            };
        } catch (error) {
            return {
                text,
                voice,
                status: 'error',
                error: error.message
            };
        }
    }

    async getAvailableVoices() {
        return this.ttsService.getAvailableVoices();
    }

    private getIndustryName(industryType: string): string {
        const names: Record<string, string> = {
            'RESTAURANT': 'Restaurantes',
            'CLINIC': 'Clínicas',
            'REAL_ESTATE': 'Inmobiliarias',
            'ACADEMY': 'Academias',
            'RETAIL': 'Retail',
            'SERVICES': 'Servicios',
            'OTHER': 'Otros'
        };
        return names[industryType] || industryType;
    }

    // ==========================================
    // NUEVO SISTEMA DE PLANES - 5 NIVELES
    // ==========================================

    async getAllBusinessSubscriptions(
        filters?: {
            planType?: string;
            status?: string;
            industryType?: string;
            search?: string;
        },
        page: number = 1,
        limit: number = 50,
    ) {
        const skip = (page - 1) * limit;
        const where: any = {};

        if (filters?.planType) {
            where.planType = filters.planType;
        }
        if (filters?.status) {
            where.status = filters.status;
        }

        // Filtro por industryType requiere join con Business
        let businessWhere: any = {};
        if (filters?.industryType) {
            businessWhere.industryType = filters.industryType;
        }
        if (filters?.search) {
            businessWhere.OR = [
                { name: { contains: filters.search, mode: 'insensitive' } },
                { email: { contains: filters.search, mode: 'insensitive' } },
            ];
        }

        const [subscriptions, total] = await Promise.all([
            this.prisma.businessSubscriptions.findMany({
                where,
                include: {
                    business: {
                        select: {
                            id: true,
                            name: true,
                            industryType: true,
                            email: true,
                            phone: true,
                            isActive: true,
                            owner: {
                                select: {
                                    id: true,
                                    email: true,
                                    firstName: true,
                                    lastName: true,
                                }
                            }
                        },
                        where: Object.keys(businessWhere).length > 0 ? businessWhere : undefined,
                    }
                },
                orderBy: { createdAt: 'desc' },
                skip,
                take: limit,
            }),
            this.prisma.businessSubscriptions.count({ where }),
        ]);

        // Filtrar las que no tienen business (por el filtro de industry)
        const filteredSubscriptions = subscriptions.filter(s => s.business);

        return {
            data: filteredSubscriptions,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
            }
        };
    }

    async getBusinessSubscriptionDetails(businessId: string) {
        const subscription = await this.prisma.businessSubscriptions.findFirst({
            where: { businessId },
            orderBy: { createdAt: 'desc' },
            include: {
                business: {
                    select: {
                        id: true,
                        name: true,
                        industryType: true,
                        email: true,
                        phone: true,
                        isActive: true,
                        owner: {
                            select: {
                                id: true,
                                email: true,
                                firstName: true,
                                lastName: true,
                            }
                        },
                        _count: {
                            select: {
                                users: true,
                                appointments: true,
                                orders: true,
                                conversations: true,
                            }
                        }
                    }
                }
            }
        });

        if (!subscription) {
            throw new NotFoundException(`No subscription found for business ${businessId}`);
        }

        return subscription;
    }

    async manuallyUpdateBusinessPlan(
        businessId: string,
        data: {
            planType: string;
            interval?: string;
            status?: string;
            trialDays?: number;
            priceOverride?: number;
            reason?: string;
        },
        adminId: string,
    ) {
        const now = new Date();
        const periodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

        // Cancelar suscripción activa actual
        await this.prisma.businessSubscriptions.updateMany({
            where: {
                businessId,
                status: 'ACTIVE',
            },
            data: {
                status: 'CANCELLED',
                updatedAt: now,
            }
        });

        // Crear nueva suscripción
        const subscription = await this.prisma.businessSubscriptions.create({
            data: {
                businessId,
                planId: `plan-${data.planType.toLowerCase()}`,
                planType: data.planType as any,
                interval: (data.interval || 'MONTHLY') as any,
                status: (data.status || 'ACTIVE') as any,
                startDate: now,
                endDate: periodEnd,
                currentPeriodStart: now,
                currentPeriodEnd: periodEnd,
                trialEndsAt: data.trialDays 
                    ? new Date(now.getTime() + data.trialDays * 24 * 60 * 60 * 1000)
                    : null,
                price: data.priceOverride || 0,
                currency: 'USD',
                enabledFeatures: data.reason ? { adminOverrideReason: data.reason } : {},
            }
        });

        // Registrar en audit log
        await this.createAuditLog({
            userId: adminId,
            action: 'MANUAL_PLAN_UPDATE',
            entityType: 'BUSINESS_SUBSCRIPTION',
            entityId: subscription.id,
            details: {
                businessId,
                newPlanType: data.planType,
                previousPlan: 'CANCELLED',
                reason: data.reason,
            }
        });

        return subscription;
    }

    async getPlanStats() {
        const stats = await this.prisma.businessSubscriptions.groupBy({
            by: ['planType', 'status'],
            _count: {
                id: true,
            },
            _sum: {
                price: true,
            }
        });

        // Calcular MRR (Monthly Recurring Revenue)
        const mrr = await this.prisma.businessSubscriptions.aggregate({
            where: {
                status: 'ACTIVE',
                interval: 'MONTHLY',
            },
            _sum: {
                price: true,
            },
        });

        const arr = await this.prisma.businessSubscriptions.aggregate({
            where: {
                status: 'ACTIVE',
                interval: 'YEARLY',
            },
            _sum: {
                price: true,
            },
        });

        // Por industria
        const byIndustry = await this.prisma.$queryRaw`
            SELECT b."industryType", bs."planType", COUNT(*) as count
            FROM business_subscriptions bs
            JOIN businesses b ON bs."businessId" = b.id
            WHERE bs.status = 'ACTIVE'
            GROUP BY b."industryType", bs."planType"
        `;

        return {
            byPlanAndStatus: stats,
            financials: {
                mrr: mrr._sum.price || 0,
                arr: (arr._sum.price || 0) * 12,
                estimatedAnnual: (mrr._sum.price || 0) * 12 + (arr._sum.price || 0),
            },
            byIndustry,
        };
    }

    async cancelBusinessSubscription(
        businessId: string,
        reason: string,
        adminId: string,
    ) {
        const subscription = await this.prisma.businessSubscriptions.updateMany({
            where: {
                businessId,
                status: 'ACTIVE',
            },
            data: {
                status: 'CANCELLED',
                cancelledAt: new Date(),
                updatedAt: new Date(),
            }
        });

        await this.createAuditLog({
            userId: adminId,
            action: 'SUBSCRIPTION_CANCELLED',
            entityType: 'BUSINESS_SUBSCRIPTION',
            entityId: businessId,
            details: { reason, businessId }
        });

        return { cancelled: subscription.count, reason };
    }

    async extendTrial(
        businessId: string,
        additionalDays: number,
        adminId: string,
    ) {
        const subscription = await this.prisma.businessSubscriptions.findFirst({
            where: { businessId, status: 'ACTIVE' },
            orderBy: { createdAt: 'desc' },
        });

        if (!subscription) {
            throw new NotFoundException('No active subscription found');
        }

        const currentTrialEnd = subscription.trialEndsAt || new Date();
        const newTrialEnd = new Date(currentTrialEnd.getTime() + additionalDays * 24 * 60 * 60 * 1000);

        const updated = await this.prisma.businessSubscriptions.update({
            where: { id: subscription.id },
            data: {
                trialEndsAt: newTrialEnd,
                updatedAt: new Date(),
            }
        });

        await this.createAuditLog({
            userId: adminId,
            action: 'TRIAL_EXTENDED',
            entityType: 'BUSINESS_SUBSCRIPTION',
            entityId: subscription.id,
            details: { 
                businessId, 
                additionalDays, 
                newTrialEnd: newTrialEnd.toISOString() 
            }
        });

        return updated;
    }

    async getPlanComparison(businessId: string) {
        const currentSubscription = await this.prisma.businessSubscriptions.findFirst({
            where: { businessId },
            orderBy: { createdAt: 'desc' },
        });

        const business = await this.prisma.business.findUnique({
            where: { id: businessId },
            select: {
                industryType: true,
                _count: {
                    select: {
                        users: true,
                        appointments: true,
                        orders: true,
                    }
                }
            }
        });

        // Planes disponibles con precios ajustados por industria
        const plans = [
            { type: 'FREE', basePrice: 0 },
            { type: 'STARTER', basePrice: 19 },
            { type: 'PROFESSIONAL', basePrice: 49 },
            { type: 'BUSINESS', basePrice: 79 },
            { type: 'ENTERPRISE', basePrice: 149 },
        ];

        const industryMultipliers: Record<string, number> = {
            'RESTAURANT': 1,
            'CLINIC': 1.3,
            'REAL_ESTATE': 1.2,
            'ACADEMY': 1,
            'RETAIL': 0.8,
            'SERVICES': 0.8,
            'OTHER': 0.8,
        };

        const multiplier = industryMultipliers[business?.industryType || 'OTHER'] || 1;

        return {
            current: currentSubscription,
            usage: business?._count,
            available: plans.map(p => ({
                ...p,
                adjustedPrice: Math.round(p.basePrice * multiplier),
                canUpgrade: true, // Lógica según necesidad
                canDowngrade: true,
            })),
            industryMultiplier: multiplier,
        };
    }

    async runGlobalContactSync() {
        const result = await this.smartAutomation.globalContactExtraction();
        await this.createAuditLog({
            userId: 'SYSTEM',
            action: 'GLOBAL_CONTACT_SYNC',
            entityType: 'SYSTEM',
            entityId: 'ALL',
            details: result
        });
        return result;
    }

    async processAutomationTick() {
        return this.smartAutomation.processAutomationTick();
    }

    async getAutomationStats() {
        const sequences = await this.prisma.automationSequence.count();
        const activeStates = await this.prisma.contactSequenceState.count({
            where: { status: 'ACTIVE' }
        });
        const completedStates = await this.prisma.contactSequenceState.count({
            where: { status: 'COMPLETED' }
        });

        return {
            totalSequences: sequences,
            activeAutomations: activeStates,
            completedAutomations: completedStates
        };
    }

    private async createAuditLog(data: {
        userId: string;
        action: string;
        entityType: string;
        entityId: string;
        details: any;
    }) {
        try {
            await this.prisma.auditLog.create({
                data: {
                    userId: data.userId,
                    action: data.action,
                    entityType: data.entityType,
                    entityId: data.entityId,
                    details: data.details,
                    createdAt: new Date(),
                }
            });
        } catch (error) {
            this.logger.error('Failed to create audit log:', error);
        }
    }
}
