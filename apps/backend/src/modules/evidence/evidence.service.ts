import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { EvidenceType, EvidenceStatus } from '@prisma/client';

export interface CreateEvidenceDto {
  businessId: string;
  customerPhone: string;
  customerName?: string;
  evidenceType: EvidenceType;
  fileId: string;
  description?: string;
}

@Injectable()
export class EvidenceService {
  private readonly logger = new Logger(EvidenceService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Crea una nueva evidencia médica
   */
  async createEvidence(dto: CreateEvidenceDto) {
    try {
      this.logger.log(`[Evidence] Creando evidencia para cliente: ${dto.customerPhone}`);

      const evidence = await this.prisma.evidence.create({
        data: {
          businessId: dto.businessId,
          customerPhone: dto.customerPhone,
          customerName: dto.customerName,
          evidenceType: dto.evidenceType,
          fileId: dto.fileId,
          description: dto.description,
          status: EvidenceStatus.PENDING,
        },
        include: {
          file: true,
          business: {
            select: {
              name: true,
              botConfig: {
                select: {
                  reviewerDestination: true,
                },
              },
            },
          },
        },
      });

      this.logger.log(`[Evidence] Evidencia creada: ${evidence.id}`);
      return evidence;
    } catch (error) {
      this.logger.error(`[Evidence] Error al crear evidencia: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Envía la evidencia al especialista (número de destino)
   */
  async sendToReviewer(evidenceId: string) {
    try {
      this.logger.log(`[Evidence] Enviando evidencia al especialista: ${evidenceId}`);

      const evidence = await this.prisma.evidence.findUnique({
        where: { id: evidenceId },
        include: {
          file: true,
          business: {
            select: {
              name: true,
              botConfig: {
                select: {
                  reviewerDestination: true,
                },
              },
            },
          },
        },
      });

      if (!evidence) {
        throw new Error('Evidencia no encontrada');
      }

      if (!evidence.business.botConfig?.reviewerDestination) {
        throw new Error('No hay número de destino configurado para el especialista');
      }

      // Actualizar el número de destino en la evidencia
      await this.prisma.evidence.update({
        where: { id: evidenceId },
        data: {
          reviewerDestination: evidence.business.botConfig.reviewerDestination,
        },
      });

      this.logger.log(`[Evidence] Evidencia preparada para envío al: ${evidence.business.botConfig.reviewerDestination}`);

      return {
        evidence,
        reviewerDestination: evidence.business.botConfig.reviewerDestination,
        message: `📋 Nueva evidencia médica de ${evidence.customerName || evidence.customerPhone}${evidence.description ? ` - ${evidence.description}` : ''}`,
      };
    } catch (error) {
      this.logger.error(`[Evidence] Error al enviar evidencia: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Obtiene evidencias pendientes de un negocio
   */
  async getPendingEvidence(businessId: string) {
    try {
      const evidences = await this.prisma.evidence.findMany({
        where: {
          businessId,
          status: EvidenceStatus.PENDING,
        },
        include: {
          file: true,
        },
        orderBy: {
          createdAt: 'desc',
        },
      });

      return evidences;
    } catch (error) {
      this.logger.error(`[Evidence] Error al obtener evidencias pendientes: ${error.message}`);
      throw error;
    }
  }

  /**
   * Marca una evidencia como revisada
   */
  async markAsReviewed(evidenceId: string) {
    try {
      const evidence = await this.prisma.evidence.update({
        where: { id: evidenceId },
        data: {
          status: EvidenceStatus.REVIEWED,
          reviewedAt: new Date(),
        },
      });

      this.logger.log(`[Evidence] Evidencia marcada como revisada: ${evidenceId}`);
      return evidence;
    } catch (error) {
      this.logger.error(`[Evidence] Error al marcar evidencia como revisada: ${error.message}`);
      throw error;
    }
  }

  /**
   * Obtiene todas las evidencias de un cliente
   */
  async getCustomerEvidence(businessId: string, customerPhone: string) {
    try {
      const evidences = await this.prisma.evidence.findMany({
        where: {
          businessId,
          customerPhone,
        },
        include: {
          file: true,
        },
        orderBy: {
          createdAt: 'desc',
        },
      });

      return evidences;
    } catch (error) {
      this.logger.error(`[Evidence] Error al obtener evidencias del cliente: ${error.message}`);
      throw error;
    }
  }
}










