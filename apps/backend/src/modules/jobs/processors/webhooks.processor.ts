import { Process, Processor } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';
import axios from 'axios';

@Processor('webhooks')
export class WebhooksProcessor {
  private readonly logger = new Logger(WebhooksProcessor.name);

  @Process({ name: 'send-webhook', concurrency: 20 })
  async handleSendWebhook(job: Job<any>) {
    const { url, event, payload, timestamp, signature, businessId } = job.data;
    
    this.logger.debug(`Sending webhook ${event} to ${url} for business ${businessId}`);

    try {
      await axios.post(url, payload, {
        headers: {
          'Content-Type': 'application/json',
          'X-SYST-Event': event,
          'X-SYST-Timestamp': timestamp.toString(),
          'X-SYST-Signature': signature,
        },
        timeout: 10000, // 10s timeout
      });
      
      this.logger.log(`✅ Webhook ${event} sent successfully to ${url}`);
    } catch (error) {
      const status = error.response?.status;
      this.logger.error(`❌ Failed to send webhook to ${url}. Status: ${status}. Error: ${error.message}`);
      
      // Si es un error 4xx (excepto 429), probablemente no tenga sentido reintentar mucho
      if (status >= 400 && status < 500 && status !== 429) {
         this.logger.warn(`Skipping further retries for ${status} error`);
         return; 
      }
      
      throw error; // Let Bull handle retries for 5xx or network errors
    }
  }
}
