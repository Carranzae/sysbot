import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';

type NotificationRecord = Prisma.NotificationGetPayload<{}>;
type PrismaJsonObject = Prisma.JsonObject | null | undefined;

interface NotificationAttachment {
  fileId: string;
  fileName: string;
  mimeType: string | null;
  size: number;
  fileType: string | null;
  downloadPath: string;
}

@Injectable()
export class NotificationsService {
  constructor(private prisma: PrismaService) {}

  async create(businessId: string, data: any) {
    const { attachmentFileId, metadata: rawMetadata, ...rest } = data || {};
    let metadata = this.normalizeMetadata(rawMetadata);

    if (attachmentFileId) {
      const attachment = await this.buildAttachmentMetadata(businessId, attachmentFileId);
      metadata = { ...metadata, attachment };
    }

    const notification = await this.prisma.notification.create({
      data: {
        businessId,
        ...rest,
        metadata: Object.keys(metadata).length ? (metadata as Prisma.JsonValue) : undefined,
      },
    });

    return this.withAttachment(notification);
  }

  async findAll(businessId: string) {
    const notifications = await this.prisma.notification.findMany({
      where: { businessId },
      orderBy: { createdAt: 'desc' },
    });

    return notifications.map((notification) => this.withAttachment(notification));
  }

  async findPending(businessId: string) {
    const notifications = await this.prisma.notification.findMany({
      where: {
        businessId,
        isSent: false,
        scheduledAt: { lte: new Date() },
      },
      orderBy: { scheduledAt: 'asc' },
    });

    return notifications.map((notification) => this.withAttachment(notification));
  }

  async markAsSent(id: string) {
    const notification = await this.prisma.notification.update({
      where: { id },
      data: {
        isSent: true,
        sentAt: new Date(),
      },
    });

    return this.withAttachment(notification);
  }

  async remove(id: string) {
    return this.prisma.notification.delete({
      where: { id },
    });
  }

  private normalizeMetadata(metadata: any): Record<string, any> {
    if (metadata && typeof metadata === 'object' && !Array.isArray(metadata)) {
      return { ...metadata };
    }
    return {};
  }

  private async buildAttachmentMetadata(
    businessId: string,
    fileId: string,
  ): Promise<NotificationAttachment> {
    const file = await this.prisma.file.findUnique({ where: { id: fileId } });
    if (!file || file.businessId !== businessId) {
      throw new BadRequestException('El archivo adjunto no existe o no pertenece a este negocio');
    }

    return {
      fileId: file.id,
      fileName: file.originalName,
      mimeType: file.mimeType,
      size: file.size,
      fileType: file.fileType,
      downloadPath: `/files/${file.id}/download`,
    };
  }

  private withAttachment(notification: NotificationRecord) {
    const metadata = notification.metadata as PrismaJsonObject;
    let attachment: NotificationAttachment | null = null;

    if (metadata && typeof metadata === 'object' && !Array.isArray(metadata)) {
      const metaAttachment = (metadata as Record<string, any>).attachment;
      if (metaAttachment && typeof metaAttachment === 'object' && !Array.isArray(metaAttachment)) {
        attachment = metaAttachment as NotificationAttachment;
      }
    }

    return {
      ...notification,
      attachment,
    };
  }
}
