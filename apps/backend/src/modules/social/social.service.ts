import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { JobsService } from '../jobs/jobs.service';

@Injectable()
export class SocialService {
  private readonly logger = new Logger(SocialService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jobsService: JobsService,
  ) {}

  async createPost(businessId: string, data: {
    caption: string;
    mediaUrl?: string;
    mediaType?: string;
    scheduledAt?: Date | string;
    targetPlatforms: string[];
  }) {
    this.logger.log(`Creating social post for business ${businessId} on platforms: ${data.targetPlatforms.join(', ')}`);

    const scheduledAt = data.scheduledAt ? new Date(data.scheduledAt) : new Date();
    const status = data.scheduledAt ? 'SCHEDULED' : 'PROCESSING';

    const post = await this.prisma.socialPost.create({
      data: {
        businessId,
        caption: data.caption,
        mediaUrl: data.mediaUrl,
        mediaType: data.mediaType || 'video',
        scheduledAt,
        status,
        targets: {
          create: data.targetPlatforms.map(platform => ({
            platform: platform.toLowerCase(),
            status: 'PENDING',
          })),
        },
      },
      include: {
        targets: true,
      },
    });

    // Encolar trabajo de procesamiento
    await this.jobsService.queueSocialPost(post.id, scheduledAt);

    return post;
  }

  async getPosts(businessId: string) {
    return this.prisma.socialPost.findMany({
      where: { businessId },
      include: { targets: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async updateTargetStatus(targetId: string, status: string, externalId?: string, errorMessage?: string) {
    return this.prisma.socialPostTarget.update({
      where: { id: targetId },
      data: {
        status,
        externalId,
        errorMessage,
        publishedAt: status === 'COMPLETED' ? new Date() : undefined,
      },
    });
  }
}
