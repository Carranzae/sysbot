import { Injectable, Logger } from '@nestjs/common';
import axios, { AxiosInstance } from 'axios';
import { CRMAdapter, CRMConfig, ContactData, ConversationData, ConversationFilters, DealData, TaskData } from '../interfaces/crm-adapter.interface';

@Injectable()
export class PipedriveCrmAdapter implements CRMAdapter {
  private readonly logger = new Logger(PipedriveCrmAdapter.name);
  private apiToken: string;
  private connectionStatus = false;
  private axios: AxiosInstance;

  async connect(config: CRMConfig): Promise<boolean> {
    try {
      this.logger.log('[Pipedrive] Connecting to Pipedrive CRM...');
      
      // Support apiKey, accessToken or custom config token
      this.apiToken = config.apiKey || config.accessToken || config.config?.apiToken;

      if (!this.apiToken) {
        this.logger.error('[Pipedrive] Connection failed: Missing API Token');
        return false;
      }

      this.axios = axios.create({
        baseURL: 'https://api.pipedrive.com/v1',
        params: {
          api_token: this.apiToken,
        },
        headers: {
          'Content-Type': 'application/json',
        },
        timeout: 15000,
      });

      // Test connection by fetching current user details
      const response = await this.axios.get('/users/me');
      
      this.connectionStatus = response.status === 200;
      if (this.connectionStatus) {
        this.logger.log(`[Pipedrive] Successfully connected to Pipedrive CRM as ${response.data.data?.name}`);
      }
      return this.connectionStatus;
    } catch (error: any) {
      this.logger.error('[Pipedrive] Connection failed:', error.response?.data || error.message);
      return false;
    }
  }

  async disconnect(): Promise<void> {
    this.apiToken = null;
    this.axios = null;
    this.connectionStatus = false;
    this.logger.log('[Pipedrive] Disconnected from Pipedrive CRM');
  }

  async isConnected(): Promise<boolean> {
    return this.connectionStatus && !!this.apiToken;
  }

  async createContact(contact: ContactData): Promise<string> {
    try {
      if (!this.isConnected()) throw new Error('Not connected to Pipedrive');

      this.logger.log(`[Pipedrive] Creating person: ${contact.firstName} (${contact.phone})`);
      
      const payload = {
        name: `${contact.firstName || ''} ${contact.lastName || ''}`.trim() || 'Sin Nombre',
        email: contact.email ? [{ value: contact.email, primary: true }] : [],
        phone: contact.phone ? [{ value: contact.phone, primary: true }] : [],
      };

      const response = await this.axios.post('/persons', payload);
      const personId = response.data?.data?.id;

      if (!personId) {
        throw new Error('No person ID returned from Pipedrive API');
      }

      this.logger.log(`[Pipedrive] Person created successfully with ID: ${personId}`);
      return personId.toString();
    } catch (error: any) {
      this.logger.error('[Pipedrive] Error creating contact:', error.response?.data || error.message);
      throw new Error(`Failed to create Pipedrive contact: ${error.message}`);
    }
  }

  async updateContact(contactId: string, data: ContactData): Promise<void> {
    try {
      if (!this.isConnected()) throw new Error('Not connected to Pipedrive');

      this.logger.log(`[Pipedrive] Updating person ID: ${contactId}`);
      
      const payload: any = {};
      if (data.firstName || data.lastName) {
        payload.name = `${data.firstName || ''} ${data.lastName || ''}`.trim();
      }
      if (data.email) {
        payload.email = [{ value: data.email, primary: true }];
      }
      if (data.phone) {
        payload.phone = [{ value: data.phone, primary: true }];
      }

      await this.axios.put(`/persons/${contactId}`, payload);
      this.logger.log(`[Pipedrive] Person ${contactId} updated successfully`);
    } catch (error: any) {
      this.logger.error('[Pipedrive] Error updating contact:', error.response?.data || error.message);
      throw new Error(`Failed to update Pipedrive contact: ${error.message}`);
    }
  }

  async getContact(contactId: string): Promise<ContactData> {
    try {
      if (!this.isConnected()) throw new Error('Not connected to Pipedrive');

      const response = await this.axios.get(`/persons/${contactId}`);
      const person = response.data?.data;

      if (!person) throw new Error('Person not found');

      return {
        id: person.id.toString(),
        firstName: person.name,
        email: person.email?.[0]?.value || '',
        phone: person.phone?.[0]?.value || '',
      };
    } catch (error: any) {
      this.logger.error('[Pipedrive] Error getting contact:', error.response?.data || error.message);
      throw new Error(`Failed to get Pipedrive contact: ${error.message}`);
    }
  }

  async searchContacts(query: string): Promise<ContactData[]> {
    try {
      if (!this.isConnected()) return [];

      const response = await this.axios.get('/persons/search', {
        params: { term: query },
      });

      const items = response.data?.data?.items || [];
      return items.map((item: any) => ({
        id: item.item?.id?.toString(),
        firstName: item.item?.name,
        email: item.item?.emails?.[0] || '',
        phone: item.item?.phones?.[0] || '',
      }));
    } catch (error: any) {
      this.logger.error('[Pipedrive] Error searching contacts:', error.response?.data || error.message);
      return [];
    }
  }

  async createConversation(conversation: ConversationData): Promise<string> {
    return conversation.id;
  }

  async sendMessage(conversationId: string, message: any): Promise<string> {
    return message.id || 'sent';
  }

  async getConversations(filters?: ConversationFilters): Promise<ConversationData[]> {
    return [];
  }

  async addLabel(contactId: string, label: string): Promise<void> {
    this.logger.log(`[Pipedrive] Adding label/tag ${label} to person ${contactId} (no-op)`);
  }

  async removeLabel(contactId: string, label: string): Promise<void> {
    this.logger.log(`[Pipedrive] Removing label/tag ${label} from person ${contactId} (no-op)`);
  }

  async getLabels(contactId: string): Promise<string[]> {
    return [];
  }

  async createLabel(label: string): Promise<string> {
    return label;
  }

  async createDeal(deal: DealData): Promise<string> {
    try {
      if (!this.isConnected()) throw new Error('Not connected to Pipedrive');

      this.logger.log(`[Pipedrive] Creating deal: ${deal.name}`);

      const stageMapping: Record<string, number> = {
        'NEW': 1,
        'CONTACTED': 2,
        'QUALIFIED': 3,
        'CONVERTED': 4,
        'LOST': 5
      };

      const payload = {
        title: deal.name,
        value: deal.amount || 0,
        person_id: deal.contactId ? parseInt(deal.contactId, 10) : undefined,
        stage_id: stageMapping[deal.stage] || 1,
      };

      const response = await this.axios.post('/deals', payload);
      const dealId = response.data?.data?.id;

      this.logger.log(`[Pipedrive] Deal created successfully with ID: ${dealId}`);
      return dealId ? dealId.toString() : '';
    } catch (error: any) {
      this.logger.error('[Pipedrive] Error creating deal:', error.response?.data || error.message);
      throw new Error(`Failed to create Pipedrive deal: ${error.message}`);
    }
  }

  async createTask(task: TaskData): Promise<string> {
    try {
      if (!this.isConnected()) throw new Error('Not connected to Pipedrive');

      this.logger.log(`[Pipedrive] Creating activity (task): ${task.title}`);

      const payload = {
        subject: task.title,
        type: 'task',
        due_date: task.dueDate ? new Date(task.dueDate).toISOString().split('T')[0] : undefined,
        person_id: task.contactId ? parseInt(task.contactId, 10) : undefined,
      };

      const response = await this.axios.post('/activities', payload);
      const activityId = response.data?.data?.id;

      this.logger.log(`[Pipedrive] Activity created successfully with ID: ${activityId}`);
      return activityId ? activityId.toString() : '';
    } catch (error: any) {
      this.logger.error('[Pipedrive] Error creating task:', error.response?.data || error.message);
      throw new Error(`Failed to create Pipedrive activity: ${error.message}`);
    }
  }
}
