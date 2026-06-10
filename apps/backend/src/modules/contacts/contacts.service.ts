import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { CreateContactDto, UpdateContactDto } from './dto/contact.dto';
import { ContactSource, MessageDirection, Prisma } from '@syst/database';

@Injectable()
export class ContactsService {
  private readonly logger = new Logger(ContactsService.name);

  constructor(private readonly prisma: PrismaService) {}

  private readonly contactListSelect = {
    id: true,
    name: true,
    phone: true,
    email: true,
    source: true,
    autoCreated: true,
    metadata: true,
    lastIncomingAt: true,
    lastOutgoingAt: true,
    createdAt: true,
    updatedAt: true,
    businessId: true,
    whatsappAccountId: true,
    tags: true,
  } satisfies Prisma.ContactSelect;

  async create(businessId: string, whatsappAccountId: string | undefined, data: CreateContactDto) {
    const { tags, ...rest } = data;
    const normalizedPhone = rest.phone?.replace(/\D/g, '') || rest.phone;
    const tail = normalizedPhone?.slice(-9);
    const existing = normalizedPhone
      ? await this.prisma.contact.findFirst({
          where: {
            businessId,
            OR: [
              { phone: normalizedPhone },
              { phone: rest.phone },
              ...(tail ? [{ phone: { endsWith: tail } }] : []),
            ],
          },
          select: { id: true },
        })
      : null;

    if (existing) {
      return this.update(existing.id, {
        ...rest,
        phone: normalizedPhone,
        tags,
      });
    }

    return this.prisma.contact.create({
      data: {
        businessId,
        whatsappAccountId,
        ...rest,
        phone: normalizedPhone,
        tags: tags
          ? {
              create: tags.map((tag) => ({
                label: tag.label.toLowerCase(),
              })),
            }
          : undefined,
      },
      select: this.contactListSelect,
    });
  }

  async findAll(businessId: string, params: { search?: string; source?: string; tag?: string } = {}) {
    const { search, source, tag } = params;
    const sourceFilter = source && Object.values(ContactSource).includes(source as ContactSource)
      ? (source as ContactSource)
      : undefined;

    const where: Prisma.ContactWhereInput = {
      businessId,
      ...(sourceFilter
        ? {
            source: sourceFilter,
          }
        : {}),
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              { phone: { contains: search, mode: 'insensitive' } },
              { email: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
      ...(tag
        ? {
            tags: {
              some: {
                label: tag.toLowerCase(),
              },
            },
          }
        : {}),
    };

    try {
      return await this.prisma.contact.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        select: this.contactListSelect,
      });
    } catch (error: any) {
      this.logger.warn(`[Contacts] Falling back without tags for business ${businessId}: ${error.message}`);

      const fallbackWhere = tag
        ? { businessId, ...(sourceFilter ? { source: sourceFilter } : {}) }
        : where;

      const contacts = await this.prisma.contact.findMany({
        where: fallbackWhere,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          name: true,
          phone: true,
          email: true,
          source: true,
          autoCreated: true,
          metadata: true,
          lastIncomingAt: true,
          lastOutgoingAt: true,
          createdAt: true,
          updatedAt: true,
          businessId: true,
          whatsappAccountId: true,
        },
      });

      const normalized = contacts.map((contact) => ({ ...contact, tags: [] }));
      if (!tag) return normalized;

      return normalized.filter((contact) => {
        const metadataTags = Array.isArray((contact.metadata as any)?.tags) ? (contact.metadata as any).tags : [];
        return metadataTags.map((item: any) => String(item).toLowerCase()).includes(tag.toLowerCase());
      });
    }
  }

  async findOne(id: string) {
    const contact = await this.prisma.contact.findUnique({
      where: { id },
      select: this.contactListSelect,
    });

    if (!contact) {
      throw new NotFoundException(`Contact ${id} not found`);
    }

    return contact;
  }

  async update(id: string, data: UpdateContactDto) {
    const { tags, ...rest } = data;

    return this.prisma.contact.update({
      where: { id },
      data: {
        ...rest,
        ...(tags
          ? {
              tags: {
                deleteMany: {},
                create: tags.map((tag) => ({
                  label: tag.label.toLowerCase(),
                })),
              },
            }
          : {}),
      },
      select: this.contactListSelect,
    });
  }

  async remove(id: string) {
    return this.prisma.contact.delete({
      where: { id },
    });
  }

  async syncFromWhatsAppAccount(accountId: string, trigger: 'manual' | 'auto') {
    const account = await this.prisma.whatsAppAccount.findUnique({
      where: { id: accountId },
      include: { business: true },
    });

    if (!account) {
      throw new NotFoundException(`WhatsApp account ${accountId} not found`);
    }

    const inboundMessages = await this.prisma.message.findMany({
      where: {
        whatsappAccountId: accountId,
        direction: MessageDirection.INBOUND,
      },
      select: {
        from: true,
        content: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    const phoneMap = new Map<string, { preview: string | null; lastInteraction: Date }>();
    inboundMessages.forEach((message) => {
      if (!message.from) return;
      if (!phoneMap.has(message.from)) {
        phoneMap.set(message.from, {
          preview: message.content?.slice(0, 120) || null,
          lastInteraction: message.createdAt,
        });
      }
    });

    const phones = Array.from(phoneMap.keys());

    const existingContacts = await this.prisma.contact.findMany({
      where: {
        businessId: account.businessId,
        phone: { in: phones },
      },
      select: { phone: true },
    });
    const existingPhoneSet = new Set(existingContacts.map((contact) => contact.phone));

    let created = 0;
    for (const phone of phones) {
      if (existingPhoneSet.has(phone)) {
        await this.prisma.contact.updateMany({
          where: { businessId: account.businessId, phone },
          data: {
            lastIncomingAt: phoneMap.get(phone)?.lastInteraction,
          },
        });
        continue;
      }

      const metadata = phoneMap.get(phone);
      await this.prisma.contact.create({
        data: {
          businessId: account.businessId,
          whatsappAccountId: account.id,
          name: `Contacto ${phone}`,
          phone,
          source: ContactSource.WHATSAPP,
          autoCreated: true,
          metadata: metadata?.preview ? { lastMessagePreview: metadata.preview } : undefined,
          lastIncomingAt: metadata?.lastInteraction,
          tags: {
            create: [{ label: 'inbound' }],
          },
        },
      });
      created += 1;
    }

    const timestampField = trigger === 'manual' ? { lastManualSyncAt: new Date() } : { lastAutoSyncAt: new Date() };
    await this.prisma.whatsAppAccount.update({
      where: { id: accountId },
      data: timestampField,
    });

    return {
      accountId,
      trigger,
      processedMessages: inboundMessages.length,
      newContacts: created,
    };
  }
}
