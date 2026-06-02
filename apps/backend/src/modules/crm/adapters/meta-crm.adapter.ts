import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import { CRMAdapter, CRMConfig, ContactData, ConversationData, ConversationFilters } from '../interfaces/crm-adapter.interface';

@Injectable()
export class MetaCrmAdapter implements CRMAdapter {
  private readonly logger = new Logger(MetaCrmAdapter.name);
  private accessToken: string;
  private pageId: string;

  async connect(config: CRMConfig): Promise<boolean> {
    this.accessToken = config.accessToken;
    this.pageId = config.config?.pageId;
    
    try {
      const response = await axios.get(
        `https://graph.facebook.com/v18.0/${this.pageId}`,
        { params: { access_token: this.accessToken } }
      );
      
      return response.status === 200;
    } catch (error) {
      this.logger.error(`[MetaCRM] Connection failed: ${error.message}`);
      return false;
    }
  }

  async disconnect(): Promise<void> {
    this.accessToken = null;
    this.pageId = null;
  }

  async isConnected(): Promise<boolean> {
    return !!this.accessToken && !!this.pageId;
  }

  async createContact(contact: ContactData): Promise<string> {
    // Meta CRM no tiene API directa para crear contactos
    // Se crean automáticamente cuando hay conversación
    return contact.platformId || contact.phone;
  }

  async updateContact(contactId: string, data: ContactData): Promise<void> {
    // Meta CRM no tiene API directa para actualizar contactos
    this.logger.warn('[MetaCRM] Update contact not directly supported');
  }

  async getContact(contactId: string): Promise<ContactData> {
    // Implementar obtención de contacto desde Meta CRM
    return { id: contactId };
  }

  async searchContacts(query: string): Promise<ContactData[]> {
    // Implementar búsqueda de contactos
    return [];
  }

  async createConversation(conversation: ConversationData): Promise<string> {
    // Las conversaciones se crean automáticamente en Meta CRM
    return conversation.id;
  }

  async sendMessage(conversationId: string, message: any): Promise<string> {
    // Implementar envío de mensaje
    return message.id || 'sent';
  }

  async getConversations(filters?: ConversationFilters): Promise<ConversationData[]> {
    try {
      const response = await axios.get(
        `https://graph.facebook.com/v18.0/${this.pageId}/conversations`,
        {
          params: {
            access_token: this.accessToken,
            fields: 'id,participants,messages{id,message,from,created_time}',
            limit: filters?.limit || 25,
          },
        }
      );
      
      return this.mapToConversationData(response.data.data || []);
    } catch (error) {
      this.logger.error(`[MetaCRM] Error getting conversations: ${error.message}`);
      return [];
    }
  }

  async addLabel(contactId: string, label: string): Promise<void> {
    try {
      await axios.post(
        `https://graph.facebook.com/v18.0/${contactId}/labels`,
        {
          access_token: this.accessToken,
          name: label,
        }
      );
    } catch (error) {
      this.logger.error(`[MetaCRM] Error adding label: ${error.message}`);
    }
  }

  async removeLabel(contactId: string, label: string): Promise<void> {
    // Implementar remoción de etiqueta
  }

  async getLabels(contactId: string): Promise<string[]> {
    // Implementar obtención de etiquetas
    return [];
  }

  async createLabel(label: string): Promise<string> {
    // Implementar creación de etiqueta
    return label;
  }

  private mapToConversationData(data: any[]): ConversationData[] {
    return data.map(item => ({
      id: item.id,
      participants: item.participants?.data?.map(p => p.id) || [],
      messages: item.messages?.data?.map(m => ({
        id: m.id,
        message: m.message,
        from: m.from?.id,
        createdAt: new Date(m.created_time),
      })) || [],
      createdAt: new Date(),
    }));
  }
}










