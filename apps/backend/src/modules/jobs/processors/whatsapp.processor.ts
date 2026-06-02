import { Process, Processor } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';
import { WhatsappWebService } from '../../whatsapp/whatsapp-web.service';

@Processor('whatsapp-messages')
export class WhatsappProcessor {
  private readonly logger = new Logger(WhatsappProcessor.name);

  constructor(private readonly whatsappWebService: WhatsappWebService) {}

  @Process({ name: 'process-message', concurrency: 10 })
  async handleProcessMessage(job: Job<{ businessId: string; message: any }>) {
    const { businessId, message } = job.data;
    this.logger.debug(`Processing queued message for business: ${businessId}`);

    try {
      await this.whatsappWebService.processSingleMessage(businessId, message);
    } catch (error) {
      this.logger.error(`Failed to process message for business ${businessId}: ${error.message}`, error.stack);
      throw error; // Let Bull handle retries
    }
  }
}
