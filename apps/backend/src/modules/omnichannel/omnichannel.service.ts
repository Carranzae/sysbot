import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ContactSource, MessageDirection, MessageStatus } from '@syst/database';
import { PrismaService } from '../database/prisma.service';
import { EmailService } from '../email/email.service';
import { WhatsappWebService } from '../whatsapp/whatsapp-web.service';
import { MessengerService } from '../meta/messenger/messenger.service';
import { InstagramService } from '../meta/instagram/instagram.service';
import { CRMFactoryService } from '../crm/crm-factory.service';

type ChannelKey = 'WHATSAPP' | 'MESSENGER' | 'INSTAGRAM' | 'EMAIL' | 'VOICE' | 'TELEGRAM' | 'LIVECHAT' | 'OTHER';

type ConversationIdentity = {
  channel: ChannelKey;
  identity: string;
};

@Injectable()
export class OmnichannelService {
  private readonly logger = new Logger(OmnichannelService.name);
  private readonly contactConversationSelect = {
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
  } as const;

  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
    private readonly whatsappWebService: WhatsappWebService,
    private readonly messengerService: MessengerService,
    private readonly instagramService: InstagramService,
    private readonly crmFactory: CRMFactoryService,
  ) {}

  async syncEmailInbox(businessId: string, limit = 25) {
    return this.emailService.syncInbox(businessId, Math.min(Math.max(Number(limit) || 25, 1), 50));
  }

  async getConversations(businessId: string, query: { channel?: string; search?: string; limit?: string }) {
    await this.syncEmailInboxBestEffort(businessId);

    const limit = Math.min(Math.max(Number(query.limit) || 80, 1), 200);
    const channel = this.normalizeChannel(query.channel);
    const search = query.search?.trim().toLowerCase();

    const [messages, contacts, leads, calls] = await Promise.all([
      this.safeFindMany('messages', businessId, () =>
        this.prisma.message.findMany({
          where: {
            businessId,
            ...(channel && channel !== 'VOICE' ? { platform: channel } : {}),
          },
          orderBy: { createdAt: 'desc' },
          take: 1000,
        }),
      ),
      this.findContactsForInbox(businessId),
      this.safeFindMany('leads', businessId, () =>
        this.prisma.lead.findMany({
          where: { businessId },
          orderBy: { updatedAt: 'desc' },
        }),
      ),
      this.safeFindMany('calls', businessId, () =>
        this.prisma.callLog.findMany({
          where: { businessId },
          include: { contact: true },
          orderBy: { createdAt: 'desc' },
          take: 300,
        }),
      ),
    ]);

    const contactsByIdentity = this.indexContacts(contacts);
    const leadsByIdentity = this.indexLeads(leads);
    const grouped = new Map<string, any>();

    for (const message of messages) {
      const messageChannel = this.normalizeChannel(message.platform) || 'WHATSAPP';
      if (channel && channel !== messageChannel) continue;

      const identity = this.messageRemoteIdentity(message);
      if (!identity) continue;

      const key = this.encodeConversation({ channel: messageChannel, identity });
      const contact = contactsByIdentity.get(this.identityKey(messageChannel, identity));
      const lead = leadsByIdentity.get(this.identityKey(messageChannel, identity));
      const existing = grouped.get(key);

      if (!existing) {
        grouped.set(key, {
          id: key,
          channel: messageChannel.toLowerCase(),
          identity,
          contact,
          lead,
          lastMessage: message.content,
          lastMessageAt: message.createdAt,
          lastDirection: message.direction,
          unread: message.direction === MessageDirection.INBOUND && message.status !== MessageStatus.READ ? 1 : 0,
          messageCount: 1,
          callCount: 0,
          hasOpenCrmAction: Boolean((lead?.metadata as any)?.nextAction),
        });
      } else {
        existing.messageCount += 1;
        if (message.direction === MessageDirection.INBOUND && message.status !== MessageStatus.READ) {
          existing.unread += 1;
        }
      }
    }

    for (const contact of contacts) {
      const contactChannel = this.contactChannel(contact);
      if (channel && channel !== contactChannel) continue;
      const identity = this.contactIdentity(contact);
      if (!identity) continue;
      const key = this.encodeConversation({ channel: contactChannel, identity });
      if (!grouped.has(key)) {
        const lead = leadsByIdentity.get(this.identityKey(contactChannel, identity));
        grouped.set(key, {
          id: key,
          channel: contactChannel.toLowerCase(),
          identity,
          contact,
          lead,
          lastMessage: (contact.metadata as any)?.lastMessagePreview || '',
          lastMessageAt: contact.lastIncomingAt || contact.lastOutgoingAt || contact.updatedAt,
          lastDirection: contact.lastOutgoingAt && (!contact.lastIncomingAt || contact.lastOutgoingAt > contact.lastIncomingAt) ? 'OUTBOUND' : 'INBOUND',
          unread: 0,
          messageCount: 0,
          callCount: 0,
          hasOpenCrmAction: Boolean((lead?.metadata as any)?.nextAction),
        });
      }
    }

    for (const call of calls) {
      const identity = call.contact?.phone || call.contactId;
      const key = this.encodeConversation({ channel: 'VOICE', identity });
      const lead = leadsByIdentity.get(this.identityKey('VOICE', identity)) || leadsByIdentity.get(this.identityKey('WHATSAPP', identity));
      const existing = grouped.get(key);

      if (!existing) {
        grouped.set(key, {
          id: key,
          channel: 'voice',
          identity,
          contact: call.contact,
          lead,
          lastMessage: call.transcription || `Llamada ${call.status.toLowerCase()} (${call.duration}s)`,
          lastMessageAt: call.createdAt,
          lastDirection: 'INBOUND',
          unread: call.status !== 'COMPLETED' || !call.queryResolved ? 1 : 0,
          messageCount: 0,
          callCount: 1,
          hasOpenCrmAction: call.crmTaskCreated || Boolean((lead?.metadata as any)?.nextAction),
        });
      } else {
        existing.callCount += 1;
        if (new Date(call.createdAt) > new Date(existing.lastMessageAt)) {
          existing.lastMessage = call.transcription || `Llamada ${call.status.toLowerCase()} (${call.duration}s)`;
          existing.lastMessageAt = call.createdAt;
        }
      }
    }

    let conversations = Array.from(grouped.values());
    if (search) {
      conversations = conversations.filter((conversation) => {
        const haystack = [
          conversation.identity,
          conversation.contact?.name,
          conversation.contact?.email,
          conversation.contact?.phone,
          conversation.lead?.name,
          conversation.lead?.email,
          conversation.lead?.phone,
          conversation.lastMessage,
        ].filter(Boolean).join(' ').toLowerCase();
        return haystack.includes(search);
      });
    }

    return conversations
      .sort((a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime())
      .slice(0, limit);
  }

  async getConversationTimeline(businessId: string, conversationId: string, limit = 100) {
    const decoded = this.decodeConversation(conversationId);
    const channel = decoded.channel;
    const identity = decoded.identity;
    const take = Math.min(Math.max(Number(limit) || 100, 1), 300);

    const contact = await this.findContactForIdentity(businessId, channel, identity);
    const lead = await this.findLeadForIdentity(businessId, channel, identity);

    const [messages, calls] = await Promise.all([
      this.safeFindMany('conversation messages', businessId, () =>
        this.prisma.message.findMany({
          where: {
            businessId,
            ...(channel !== 'VOICE' ? { platform: channel } : {}),
            OR: [{ from: identity }, { to: identity }],
          },
          orderBy: { createdAt: 'asc' },
          take,
        }),
      ),
      contact
        ? this.safeFindMany('conversation calls', businessId, () =>
            this.prisma.callLog.findMany({
              where: { businessId, contactId: contact.id },
              orderBy: { createdAt: 'asc' },
              take,
            }),
          )
        : Promise.resolve([]),
    ]);

    const timeline = [
      ...messages.map((message) => ({
        id: message.id,
        type: 'message',
        channel: (message.platform || channel).toLowerCase(),
        direction: message.direction === MessageDirection.INBOUND ? 'incoming' : 'outgoing',
        body: message.content,
        status: message.status.toLowerCase(),
        mediaUrl: message.mediaUrl,
        metadata: message.metadata,
        createdAt: message.createdAt,
      })),
      ...calls.map((call) => ({
        id: call.id,
        type: 'call',
        channel: 'voice',
        direction: 'incoming',
        body: call.transcription || `Llamada ${call.status.toLowerCase()} (${call.duration}s)`,
        status: call.status.toLowerCase(),
        recordingUrl: call.recordingUrl,
        sentiment: call.sentimentAnalysis,
        queryResolved: call.queryResolved,
        crmTaskCreated: call.crmTaskCreated,
        createdAt: call.createdAt,
      })),
    ].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

    return {
      id: conversationId,
      channel: channel.toLowerCase(),
      identity,
      contact,
      lead,
      timeline,
    };
  }

  async sendMessage(businessId: string, conversationId: string, body: { message: string; subject?: string }) {
    const decoded = this.decodeConversation(conversationId);
    const text = body.message?.trim();
    if (!text) throw new BadRequestException('message is required');

    const contact = await this.findContactForIdentity(businessId, decoded.channel, decoded.identity);

    switch (decoded.channel) {
      case 'EMAIL': {
        const to = contact?.email || decoded.identity;
        await this.emailService.sendEmail({
          businessId,
          to: [to],
          subject: body.subject || 'Respuesta de Sysbot',
          text,
          html: text.replace(/\n/g, '<br />'),
        });
        return this.persistOutbound(businessId, decoded, text, contact?.email || to, 'EMAIL');
      }
      case 'MESSENGER':
        await this.messengerService.sendMessageToMessenger(businessId, decoded.identity, text);
        return this.persistOutbound(businessId, decoded, text, decoded.identity, 'MESSENGER');
      case 'INSTAGRAM':
        await this.instagramService.sendMessageToInstagram(businessId, decoded.identity, text);
        return this.persistOutbound(businessId, decoded, text, decoded.identity, 'INSTAGRAM');
      case 'WHATSAPP':
      default: {
        const target = decoded.identity.includes('@') ? decoded.identity : `${decoded.identity}@s.whatsapp.net`;
        await this.whatsappWebService.sendMessage(businessId, target, text);
        return this.persistOutbound(businessId, decoded, text, decoded.identity, 'WHATSAPP');
      }
    }
  }

  async upsertCrmContext(businessId: string, conversationId: string, data: any) {
    const decoded = this.decodeConversation(conversationId);
    const contact = await this.ensureContact(businessId, decoded, data.contact || {});
    const metadata = {
      ...(data.lead?.metadata || {}),
      leadScore: Number(data.leadScore || data.lead?.leadScore || 0),
      dealAmount: Number(data.dealAmount || data.lead?.dealAmount || 0),
      nextAction: data.nextAction || data.lead?.nextAction || null,
      crmStage: data.stage || data.lead?.status || 'NEW',
      sourceChannel: decoded.channel,
      conversationId,
    };

    const existingLead = await this.findLeadForIdentity(businessId, decoded.channel, decoded.identity);
    const leadPayload = {
      name: data.name || contact.name || decoded.identity,
      phone: contact.phone || decoded.identity,
      email: contact.email || data.email || undefined,
      source: decoded.channel,
      status: data.stage || data.status || existingLead?.status || 'NEW',
      notes: data.notes || existingLead?.notes || undefined,
      lastContactAt: new Date(),
      metadata,
    };

    const lead = existingLead
      ? await this.prisma.lead.update({ where: { id: existingLead.id }, data: leadPayload as any })
      : await this.prisma.lead.create({ data: { businessId, ...leadPayload } as any });

    await this.syncCrmBestEffort(businessId, contact, lead, metadata);

    return { contact, lead };
  }

  private async persistOutbound(businessId: string, decoded: ConversationIdentity, content: string, to: string, platform: ChannelKey) {
    await this.prisma.contact.updateMany({
      where: { businessId, OR: [{ phone: decoded.identity }, { email: decoded.identity }] },
      data: { lastOutgoingAt: new Date() },
    });

    return this.prisma.message.create({
      data: {
        businessId,
        direction: MessageDirection.OUTBOUND,
        content,
        from: '',
        to,
        platform,
        status: MessageStatus.SENT,
      },
    });
  }

  private async ensureContact(businessId: string, decoded: ConversationIdentity, data: any) {
    const existing = await this.findContactForIdentity(businessId, decoded.channel, decoded.identity);
    const source = this.contactSourceForChannel(decoded.channel);
    const payload = {
      name: data.name || existing?.name || decoded.identity,
      phone: data.phone || existing?.phone || decoded.identity,
      email: data.email || existing?.email || (decoded.channel === 'EMAIL' ? decoded.identity : undefined),
      source,
      metadata: {
        ...((existing?.metadata as any) || {}),
        ...(data.metadata || {}),
        channel: decoded.channel,
        externalIdentity: decoded.identity,
      },
    };

    if (existing) {
      try {
        return await this.prisma.contact.update({ where: { id: existing.id }, data: payload as any, select: this.contactConversationSelect });
      } catch (error: any) {
        this.logger.warn(`[Omnichannel] Contact update fell back without tags: ${error.message}`);
        const updated = await this.prisma.contact.update({
          where: { id: existing.id },
          data: payload as any,
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
        return { ...updated, tags: [] };
      }
    }

    try {
      return await this.prisma.contact.create({
        data: { businessId, ...payload, autoCreated: true } as any,
        select: this.contactConversationSelect,
      });
    } catch (error: any) {
      this.logger.warn(`[Omnichannel] Contact create fell back without tags: ${error.message}`);
      const created = await this.prisma.contact.create({
        data: { businessId, ...payload, autoCreated: true } as any,
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
      return { ...created, tags: [] };
    }
  }

  private async syncCrmBestEffort(businessId: string, contact: any, lead: any, metadata: any) {
    try {
      const adapter = await this.crmFactory.getAdapterForBusiness(businessId);
      if (!adapter) return;

      const externalContactId = (contact.metadata as any)?.crmContactId || contact.id;
      const contactData = {
        id: externalContactId,
        firstName: contact.name || lead.name,
        lastName: '',
        email: contact.email || lead.email || '',
        phone: contact.phone || lead.phone || '',
        platformId: metadata.sourceChannel,
      };

      try {
        await adapter.updateContact(externalContactId, contactData);
      } catch {
        const crmContactId = await adapter.createContact(contactData);
        await this.prisma.contact.update({
          where: { id: contact.id },
          data: { metadata: { ...((contact.metadata as any) || {}), crmContactId } },
        });
      }

      if (adapter.createDeal && metadata.dealAmount) {
        await adapter.createDeal({
          name: `Sysbot - ${lead.name}`,
          amount: metadata.dealAmount,
          contactId: externalContactId,
          stage: lead.status,
          notes: lead.notes || '',
        });
      }

      if (adapter.createTask && metadata.nextAction) {
        await adapter.createTask({
          title: metadata.nextAction,
          dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
          contactId: externalContactId,
        });
      }
    } catch (error: any) {
      this.logger.warn(`[Omnichannel CRM] Sync skipped: ${error.message}`);
    }
  }

  private async syncEmailInboxBestEffort(businessId: string) {
    try {
      await this.emailService.syncInbox(businessId, 10);
    } catch (error: any) {
      this.logger.debug(`[Omnichannel] Gmail inbox sync skipped: ${error.message}`);
    }
  }

  private async safeFindMany<T>(label: string, businessId: string, query: () => Promise<T[]>): Promise<T[]> {
    try {
      return await query();
    } catch (error: any) {
      this.logger.warn(`[Omnichannel] ${label} query skipped for business ${businessId}: ${error.message}`);
      return [];
    }
  }

  private async findContactsForInbox(businessId: string) {
    try {
      return await this.prisma.contact.findMany({
        where: { businessId },
        select: this.contactConversationSelect,
        orderBy: { updatedAt: 'desc' },
      });
    } catch (error: any) {
      this.logger.warn(`[Omnichannel] contacts query fell back without tags for business ${businessId}: ${error.message}`);
      const contacts = await this.safeFindMany('contacts fallback', businessId, () =>
        this.prisma.contact.findMany({
          where: { businessId },
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
          orderBy: { updatedAt: 'desc' },
        }),
      );
      return contacts.map((contact: any) => ({ ...contact, tags: [] }));
    }
  }

  private indexContacts(contacts: any[]) {
    const map = new Map<string, any>();
    for (const contact of contacts) {
      const channel = this.contactChannel(contact);
      for (const identity of [contact.phone, contact.email, (contact.metadata as any)?.externalIdentity].filter(Boolean)) {
        map.set(this.identityKey(channel, identity), contact);
        map.set(this.identityKey('WHATSAPP', identity), contact);
        map.set(this.identityKey('EMAIL', identity), contact);
      }
    }
    return map;
  }

  private indexLeads(leads: any[]) {
    const map = new Map<string, any>();
    for (const lead of leads) {
      const channel = this.normalizeChannel(lead.source) || this.normalizeChannel((lead.metadata as any)?.sourceChannel) || 'WHATSAPP';
      for (const identity of [lead.phone, lead.email].filter(Boolean)) {
        map.set(this.identityKey(channel, identity), lead);
        map.set(this.identityKey('WHATSAPP', identity), lead);
        map.set(this.identityKey('EMAIL', identity), lead);
      }
    }
    return map;
  }

  private async findContactForIdentity(businessId: string, channel: ChannelKey, identity: string) {
    try {
      return await this.prisma.contact.findFirst({
        where: {
          businessId,
          OR: [
            { phone: identity },
            { email: identity },
            { metadata: { path: ['externalIdentity'], equals: identity } as any },
          ],
        },
        select: this.contactConversationSelect,
      });
    } catch (error: any) {
      this.logger.warn(`[Omnichannel] contact identity lookup fell back for ${businessId}: ${error.message}`);
      const contact = await this.prisma.contact.findFirst({
        where: {
          businessId,
          OR: [{ phone: identity }, { email: identity }],
        },
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
      return contact ? { ...contact, tags: [] } : null;
    }
  }

  private async findLeadForIdentity(businessId: string, channel: ChannelKey, identity: string) {
    try {
      return await this.prisma.lead.findFirst({
        where: {
          businessId,
          OR: [
            { phone: identity },
            { email: identity },
            {
              AND: [
                { source: channel },
                { metadata: { path: ['conversationId'], equals: this.encodeConversation({ channel, identity }) } as any },
              ],
            },
          ],
        },
        orderBy: { updatedAt: 'desc' },
      });
    } catch (error: any) {
      this.logger.warn(`[Omnichannel] lead identity lookup fell back for ${businessId}: ${error.message}`);
      return this.prisma.lead.findFirst({
        where: {
          businessId,
          OR: [{ phone: identity }, { email: identity }],
        },
        orderBy: { updatedAt: 'desc' },
      });
    }
  }

  private messageRemoteIdentity(message: any) {
    const inbound = message.direction === MessageDirection.INBOUND;
    return inbound ? message.from : message.to;
  }

  private contactIdentity(contact: any) {
    return (contact.metadata as any)?.externalIdentity || contact.email || contact.phone;
  }

  private contactChannel(contact: any): ChannelKey {
    return this.normalizeChannel((contact.metadata as any)?.channel) || this.normalizeChannel(contact.source) || 'WHATSAPP';
  }

  private contactSourceForChannel(channel: ChannelKey): ContactSource {
    if (channel === 'WHATSAPP') return ContactSource.WHATSAPP;
    if (channel === 'MESSENGER') return ContactSource.MESSENGER;
    if (channel === 'INSTAGRAM') return ContactSource.INSTAGRAM;
    if (channel === 'TELEGRAM') return ContactSource.TELEGRAM;
    if (channel === 'LIVECHAT') return ContactSource.LIVECHAT;
    return ContactSource.OTHER;
  }

  private normalizeChannel(value?: string | null): ChannelKey | null {
    const normalized = String(value || '').trim().toUpperCase();
    if (!normalized) return null;
    if (normalized === 'FACEBOOK') return 'MESSENGER';
    if (normalized === 'CALL' || normalized === 'PHONE' || normalized === 'VOICE') return 'VOICE';
    if (['WHATSAPP', 'MESSENGER', 'INSTAGRAM', 'EMAIL', 'VOICE', 'TELEGRAM', 'LIVECHAT'].includes(normalized)) {
      return normalized as ChannelKey;
    }
    return 'OTHER';
  }

  private identityKey(channel: ChannelKey, identity: string) {
    return `${channel}:${String(identity).trim().toLowerCase()}`;
  }

  private encodeConversation(payload: ConversationIdentity) {
    return Buffer.from(JSON.stringify(payload)).toString('base64url');
  }

  private decodeConversation(id: string): ConversationIdentity {
    try {
      const payload = JSON.parse(Buffer.from(id, 'base64url').toString('utf8'));
      const channel = this.normalizeChannel(payload.channel);
      if (!channel || !payload.identity) throw new Error('Invalid conversation id');
      return { channel, identity: String(payload.identity) };
    } catch {
      throw new NotFoundException('Conversation not found');
    }
  }
}
