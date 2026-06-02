import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { CreateCampaignDto, UpdateCampaignStatusDto } from './dto/campaign.dto';
import { CampaignStatus } from '@syst/database';
import { JobsService } from '../jobs/jobs.service';

@Injectable()
export class CampaignsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jobsService: JobsService,
  ) {}

  private async ensureContactsBelongToBusiness(businessId: string, contactIds: string[]) {
    const count = await this.prisma.contact.count({
      where: {
        businessId,
        id: { in: contactIds },
      },
    });

    if (count !== contactIds.length) {
      throw new BadRequestException('One or more contacts do not belong to this business.');
    }
  }

  async create(businessId: string, dto: CreateCampaignDto) {
    if (!dto.recipients?.length) {
      throw new BadRequestException('At least one recipient is required.');
    }

    await this.ensureContactsBelongToBusiness(
      businessId,
      dto.recipients.map((recipient) => recipient.contactId),
    );

    const status: CampaignStatus = dto.scheduledAt ? CampaignStatus.SCHEDULED : CampaignStatus.SENDING;

    const campaign = await this.prisma.campaign.create({
      data: {
        businessId,
        name: dto.name,
        subject: dto.subject,
        channel: dto.channel,
        message: dto.message,
        scheduledAt: dto.scheduledAt ? new Date(dto.scheduledAt) : null,
        status,
        recipients: {
          create: dto.recipients.map((recipient) => ({
            contact: {
              connect: { id: recipient.contactId },
            },
          })),
        },
      } as any,
      include: {
        recipients: {
          include: {
            contact: true,
          },
        },
      },
    });

    await this.jobsService.queueCampaignDispatch(
      campaign.id,
      dto.scheduledAt ? new Date(dto.scheduledAt) : undefined,
    );

    return campaign;
  }

  async findAll(businessId: string, status?: CampaignStatus) {
    return this.prisma.campaign.findMany({
      where: {
        businessId,
        ...(status ? { status } : {}),
      },
      orderBy: { createdAt: 'desc' },
      include: {
        recipients: {
          include: { contact: true },
        },
      },
    });
  }

  async findOne(id: string) {
    const campaign = await this.prisma.campaign.findUnique({
      where: { id },
      include: {
        recipients: {
          include: { contact: true },
        },
      },
    });

    if (!campaign) {
      throw new NotFoundException(`Campaign ${id} not found`);
    }

    return campaign;
  }

  async updateStatus(id: string, dto: UpdateCampaignStatusDto) {
    await this.findOne(id);
    const campaign = (await this.prisma.campaign.update({
      where: { id },
      data: { status: dto.status },
      include: {
        recipients: {
          include: { contact: true },
        },
      },
    })) as any;

    if (dto.status === CampaignStatus.SCHEDULED && campaign.scheduledAt) {
      await this.jobsService.queueCampaignDispatch(campaign.id, campaign.scheduledAt);
    }

    return campaign;
  }

  async duplicate(id: string) {
    const baseCampaign = (await this.findOne(id)) as any;
    const duplicated = await this.prisma.campaign.create({
      data: {
        businessId: baseCampaign.businessId,
        name: `${baseCampaign.name} (copia)`,
        message: baseCampaign.message,
        subject: baseCampaign.subject,
        channel: baseCampaign.channel,
        status: CampaignStatus.DRAFT,
        recipients: {
          create: baseCampaign.recipients.map((recipient) => ({
            contact: { connect: { id: recipient.contactId } },
          })),
        },
      } as any,
      include: {
        recipients: { include: { contact: true } },
      },
    });

    return duplicated;
  }

  async resend(id: string) {
    const campaign = (await this.findOne(id)) as any;
    const updated = (await this.prisma.campaign.update({
      where: { id },
      data: {
        status: CampaignStatus.SCHEDULED,
        scheduledAt: new Date(),
      },
      include: {
        recipients: { include: { contact: true } },
      },
    })) as any;

    await this.jobsService.queueCampaignDispatch(updated.id, updated.scheduledAt || undefined);

    return updated;
  }
}
