import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { JobsService } from '../jobs/jobs.service';
import { CampaignStatus } from '@syst/database';

@Injectable()
export class SmartAutomationService {
    private readonly logger = new Logger(SmartAutomationService.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly jobsService: JobsService,
    ) { }

    /**
     * Extrae contactos de mensajes pasados para todos los negocios que no los tengan
     */
    async globalContactExtraction() {
        const businesses = await this.prisma.business.findMany({
            include: { whatsappAccounts: true }
        });

        let totalExtracted = 0;
        for (const biz of businesses) {
            for (const account of biz.whatsappAccounts) {
                // Lógica similar a ContactsService.syncFromWhatsAppAccount
                // pero simplificada para ejecución masiva
                const result = await this.syncContacts(biz.id, account.id);
                totalExtracted += result.newContacts;
            }
        }

        return { totalExtracted, businessesProcessed: businesses.length };
    }

    private async syncContacts(businessId: string, accountId: string) {
        // Obtenemos números de teléfono de mensajes entrantes
        const rawMessages = await this.prisma.message.findMany({
            where: {
                businessId,
                whatsappAccountId: accountId,
                direction: 'INBOUND'
            },
            select: { from: true },
            distinct: ['from']
        });

        let newContacts = 0;
        for (const msg of rawMessages) {
            const existing = await this.prisma.contact.findFirst({
                where: { businessId, phone: msg.from }
            });

            if (!existing) {
                await this.prisma.contact.create({
                    data: {
                        businessId,
                        whatsappAccountId: accountId,
                        phone: msg.from,
                        name: `Lead Auto ${msg.from.slice(-4)}`,
                        source: 'WHATSAPP',
                        autoCreated: true,
                        tags: { create: [{ label: 'auto-extracted' }] }
                    }
                });
                newContacts++;
            }
        }
        return { newContacts };
    }

    /**
     * Procesa las secuencias de automatización pendientes (Algoritmos)
     */
    async processAutomationTick() {
        const states = await this.prisma.contactSequenceState.findMany({
            where: {
                status: 'ACTIVE',
                nextRunAt: { lte: new Date() }
            },
            include: {
                sequence: { include: { steps: true } },
                contact: true
            }
        });

        this.logger.log(`Processing ${states.length} automation steps`);

        for (const state of states) {
            const currentStep = state.sequence.steps.find(s => s.order === state.currentStep);
            
            if (currentStep) {
                await this.executeStep(state, currentStep);
                
                // Programar el siguiente paso
                const nextStep = state.sequence.steps.find(s => s.order === state.currentStep + 1);
                if (nextStep) {
                    await this.prisma.contactSequenceState.update({
                        where: { id: state.id },
                        data: {
                            currentStep: state.currentStep + 1,
                            lastRunAt: new Date(),
                            nextRunAt: new Date(Date.now() + nextStep.delayHours * 3600000)
                        }
                    });
                } else {
                    // Fin de la secuencia
                    await this.prisma.contactSequenceState.update({
                        where: { id: state.id },
                        data: { status: 'COMPLETED', lastRunAt: new Date(), nextRunAt: null }
                    });
                }
            }
        }
    }

    private async executeStep(state: any, step: any) {
        // Aquí se envía el mensaje o archivo
        if (step.actionType === 'SEND_MESSAGE' || step.actionType === 'SEND_FILE') {
            await this.jobsService.queueWhatsappMessage(state.sequence.businessId, {
                to: state.contact.phone,
                content: step.content,
                mediaUrl: step.mediaUrl,
                type: step.actionType === 'SEND_FILE' ? 'DOCUMENT' : 'TEXT'
            });
        } else if (step.actionType === 'ADD_TAG' && step.content) {
            await this.prisma.contactTag.create({
                data: {
                    contactId: state.contactId,
                    label: step.content
                }
            });
        }
    }

    /**
     * Inicia una secuencia para un contacto (Lead Nurturing)
     */
    async startSequence(contactId: string, sequenceId: string) {
        const sequence = await this.prisma.automationSequence.findUnique({
            where: { id: sequenceId },
            include: { steps: { orderBy: { order: 'asc' } } }
        });

        if (!sequence || sequence.steps.length === 0) return;

        const firstStep = sequence.steps[0];
        
        await this.prisma.contactSequenceState.upsert({
            where: { contactId_sequenceId: { contactId, sequenceId } },
            create: {
                contactId,
                sequenceId,
                currentStep: 0,
                status: 'ACTIVE',
                nextRunAt: new Date(Date.now() + firstStep.delayHours * 3600000)
            },
            update: {
                status: 'ACTIVE',
                currentStep: 0,
                nextRunAt: new Date(Date.now() + firstStep.delayHours * 3600000)
            }
        });
    }
}
