import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { BotRuleTriggerType } from '@syst/database';

@Injectable()
export class BotRulesService {
  private readonly logger = new Logger(BotRulesService.name);

  constructor(private readonly prisma: PrismaService) {}

  async evaluateRules(businessId: string, message: string, platform?: string) {
    const rules = await this.prisma.botRule.findMany({
      where: {
        businessId,
        active: true,
      },
      orderBy: {
        priority: 'asc',
      },
    });

    const normalizedMessage = message.trim().toLowerCase();

    for (const rule of rules) {
      // Check if platform matches (if specified in rule)
      if (platform && rule.channels && rule.channels.length > 0) {
        if (!rule.channels.includes(platform)) {
          continue;
        }
      }

      let matches = false;

      switch (rule.triggerType) {
        case BotRuleTriggerType.EXACT:
          matches = normalizedMessage === (rule.triggerValue || '').trim().toLowerCase();
          break;

        case BotRuleTriggerType.KEYWORDS:
          const keywords = rule.keywords || [];
          matches = keywords.some((kw) => normalizedMessage.includes(kw.toLowerCase()));
          break;

        case BotRuleTriggerType.REGEX:
          try {
            const regex = new RegExp(rule.triggerValue || '', 'i');
            matches = regex.test(message);
          } catch (e) {
            this.logger.error(`Invalid regex in rule ${rule.id}: ${rule.triggerValue}`);
          }
          break;
      }

      if (matches) {
        return {
          match: true,
          rule,
          response: rule.responseText,
        };
      }
    }

    return { match: false };
  }

  async create(businessId: string, data: any) {
    return this.prisma.botRule.create({
      data: {
        ...data,
        businessId,
      },
    });
  }

  async findAll(businessId: string) {
    return this.prisma.botRule.findMany({
      where: { businessId },
      orderBy: { priority: 'asc' },
    });
  }

  async findOne(id: string, businessId: string) {
    return this.prisma.botRule.findFirst({
      where: { id, businessId },
    });
  }

  async update(id: string, businessId: string, data: any) {
    return this.prisma.botRule.update({
      where: { id },
      data,
    });
  }

  async remove(id: string, businessId: string) {
    return this.prisma.botRule.delete({
      where: { id },
    });
  }
}
