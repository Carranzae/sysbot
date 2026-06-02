import { Processor, Process } from '@nestjs/bull';
import { Job } from 'bull';
import { PrismaService } from '../../database/prisma.service';
import { EmailService } from '../../email/email.service';
import { WhatsappService } from '../../whatsapp/whatsapp.service';
import { WhatsappWebService } from '../../whatsapp/whatsapp-web.service';
import { MessengerService } from '../../meta/messenger/messenger.service';
import { InstagramService } from '../../meta/instagram/instagram.service';
import { CampaignStatus, MessageStatus } from '@syst/database';

@Processor('campaigns')
export class CampaignsProcessor {
  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
    private readonly whatsappService: WhatsappService,
    private readonly whatsappWebService: WhatsappWebService,
    private readonly messengerService: MessengerService,
    private readonly instagramService: InstagramService,
  ) {}

  @Process('dispatch-campaign')
  async handleCampaign(job: Job<{ campaignId: string }>) {
    const { campaignId } = job.data;

    const campaign = await this.prisma.campaign.findUnique({
      where: { id: campaignId },
      include: {
        recipients: {
          include: {
            contact: true,
          },
        },
        business: {
          include: {
            botConfig: true,
            whatsappAccounts: {
              where: { isActive: true },
              orderBy: { createdAt: 'asc' },
            },
          },
        },
      },
    });

    if (!campaign) {
      return;
    }

    if (!campaign.recipients.length) {
      await this.prisma.campaign.update({
        where: { id: campaignId },
        data: { status: CampaignStatus.FAILED },
      });
      return;
    }

    await this.prisma.campaign.update({
      where: { id: campaignId },
      data: { status: CampaignStatus.SENDING },
    });

    let successCount = 0;

    for (const recipient of campaign.recipients) {
      try {
        await this.dispatchToRecipient(campaign, recipient);
        successCount++;
        await this.prisma.campaignRecipient.update({
          where: { id: recipient.id },
          data: {
            status: MessageStatus.SENT,
            sentAt: new Date(),
            errorMessage: null,
          },
        });
      } catch (error: any) {
        await this.prisma.campaignRecipient.update({
          where: { id: recipient.id },
          data: {
            status: MessageStatus.FAILED,
            errorMessage: error?.message?.slice(0, 200) ?? 'Unknown error',
          },
        });
      }
    }

    const finalStatus =
      successCount === campaign.recipients.length ? CampaignStatus.SENT : CampaignStatus.FAILED;

    await this.prisma.campaign.update({
      where: { id: campaignId },
      data: { status: finalStatus },
    });
  }

  private async dispatchToRecipient(
    campaign: any,
    recipient: {
      id: string;
      contact: { email: string | null; phone: string | null };
    },
  ) {
    const channel = campaign.channel.toLowerCase();

    if (channel === 'email') {
      await this.sendEmail(campaign, recipient);
      return;
    }

    if (channel === 'whatsapp') {
      await this.sendWhatsapp(campaign, recipient);
      return;
    }

    if (channel === 'messenger') {
      await this.sendMessenger(campaign, recipient);
      return;
    }

    if (channel === 'instagram_dm') {
      await this.sendInstagram(campaign, recipient);
      return;
    }

    throw new Error(`Unsupported campaign channel: ${campaign.channel}`);
  }

  private async sendEmail(
    campaign: any,
    recipient: {
      contact: { email: string | null };
    },
  ) {
    if (!recipient.contact.email) {
      throw new Error('Contact does not have an email address');
    }

    await this.emailService.sendEmail({
      businessId: campaign.businessId,
      to: [recipient.contact.email],
      subject: campaign.subject || campaign.name,
      html: campaign.message,
      text: this.stripHtml(campaign.message),
    });
  }

  private async sendWhatsapp(
    campaign: any,
    recipient: {
      contact: { phone: string | null };
    },
  ) {
    if (!recipient.contact.phone) {
      throw new Error('Contact does not have a phone number');
    }

    const config = campaign.business.botConfig;
    const mode = config?.whatsappMode;
    const isWebEnabled = config?.whatsappWebEnabled === true || mode === 'WHATSAPP_WEB';
    const isApiEnabled = config?.whatsappApiEnabled === true || mode === 'WHATSAPP_API';

    if (isWebEnabled) {
      // Modo WhaSender (Web Automation)
      await this.whatsappWebService.sendText(campaign.businessId, recipient.contact.phone, campaign.message);
    } else if (isApiEnabled) {
      // Modo API Oficial
      const account = campaign.business.whatsappAccounts?.[0];
      if (!account) {
        throw new Error('No WhatsApp API account configured for this business');
      }
      await this.whatsappService.sendMessage(account.phoneNumberId, recipient.contact.phone, campaign.message);
    } else {
      throw new Error('No WhatsApp sending method enabled for this business');
    }
  }

  private async sendMessenger(
    campaign: any,
    recipient: any,
  ) {
    const recipientId = recipient.contact.source === 'MESSENGER' ? recipient.contact.id : null;
    if (!recipientId) {
      throw new Error('Contact does not have a valid Messenger PSID');
    }
    await this.messengerService.sendMessageToMessenger(campaign.businessId, recipientId, campaign.message);
  }

  private async sendInstagram(
    campaign: any,
    recipient: any,
  ) {
    const recipientId = recipient.contact.source === 'INSTAGRAM' ? recipient.contact.id : null;
    if (!recipientId) {
      throw new Error('Contact does not have a valid Instagram SID');
    }
    await this.instagramService.sendMessageToInstagram(campaign.businessId, recipientId, campaign.message);
  }

  private stripHtml(value: string) {
    return value?.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  }
}
