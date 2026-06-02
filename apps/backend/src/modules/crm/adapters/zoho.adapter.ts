import { Injectable, Logger } from '@nestjs/common';
import axios, { AxiosInstance } from 'axios';
import { CRMAdapter, CRMConfig, ContactData, ConversationData, ConversationFilters, DealData, TaskData } from '../interfaces/crm-adapter.interface';

export interface ZohoContact {
  id: string;
  First_Name?: string;
  Last_Name?: string;
  Email?: string;
  Phone?: string;
  Created_Time: string;
  Modified_Time: string;
}

export interface ZohoDeal {
  id: string;
  Deal_Name?: string;
  Amount?: number;
  Stage?: string;
  Closing_Date?: string;
  Created_Time: string;
}

@Injectable()
export class ZohoCrmAdapter implements CRMAdapter {
  private readonly logger = new Logger(ZohoCrmAdapter.name);
  private accessToken: string;
  private refreshToken: string;
  private clientId: string;
  private clientSecret: string;
  private axios: AxiosInstance;
  private connectionStatus = false;

  async connect(config: CRMConfig): Promise<boolean> {
    try {
      this.logger.log('[Zoho] Connecting to Zoho CRM...');
      
      this.accessToken = config.accessToken;
      this.refreshToken = config.refreshToken;
      this.clientId = config.apiKey;
      this.clientSecret = config.apiSecret;

      // Configurar axios con headers por defecto
      this.axios = axios.create({
        baseURL: 'https://www.zohoapis.com/crm/v6',
        headers: {
          'Authorization': `Zoho-oauthtoken ${this.accessToken}`,
          'Content-Type': 'application/json'
        },
        timeout: 30000
      });

      // Probar conexión obteniendo información de usuarios
      const response = await this.axios.get('/users?type=CurrentUser');
      
      this.connectionStatus = true;
      this.logger.log('[Zoho] Successfully connected to Zoho CRM');
      return true;
    } catch (error) {
      this.logger.error('[Zoho] Connection failed:', error.response?.data || error.message);
      
      // Intentar refresh token si es error de autorización
      if (error.response?.status === 401 && this.refreshToken) {
        return await this.refreshAccessToken();
      }
      
      return false;
    }
  }

  async disconnect(): Promise<void> {
    this.accessToken = null;
    this.refreshToken = null;
    this.clientId = null;
    this.clientSecret = null;
    this.axios = null;
    this.connectionStatus = false;
    this.logger.log('[Zoho] Disconnected from Zoho CRM');
  }

  async isConnected(): Promise<boolean> {
    return this.connectionStatus && !!this.accessToken;
  }

  private async refreshAccessToken(): Promise<boolean> {
    try {
      this.logger.log('[Zoho] Refreshing access token...');
      
      const response = await axios.post('https://accounts.zoho.com/oauth/v2/token', {
        grant_type: 'refresh_token',
        refresh_token: this.refreshToken,
        client_id: this.clientId,
        client_secret: this.clientSecret
      });

      this.accessToken = response.data.access_token;
      
      // Actualizar axios con nuevo token
      if (this.axios) {
        this.axios.defaults.headers['Authorization'] = `Zoho-oauthtoken ${this.accessToken}`;
      }

      this.logger.log('[Zoho] Access token refreshed successfully');
      return true;
    } catch (error) {
      this.logger.error('[Zoho] Failed to refresh access token:', error.message);
      return false;
    }
  }

  async createContact(contact: ContactData): Promise<string> {
    try {
      this.logger.log(`[Zoho] Creating contact: ${contact.email}`);
      
      const payload = {
        data: [{
          First_Name: contact.firstName || '',
          Last_Name: contact.lastName || 'Unknown',
          Email: contact.email,
          Phone: contact.phone,
          Lead_Source: 'SYST Bot'
        }]
      };

      const response = await this.axios.post('/Contacts', payload);
      
      this.logger.log(`[Zoho] Contact created: ${response.data.data[0].details.id}`);
      return response.data.data[0].details.id;
    } catch (error) {
      this.logger.error('[Zoho] Error creating contact:', error.response?.data || error.message);
      throw new Error(`Failed to create Zoho contact: ${error.message}`);
    }
  }

  async updateContact(contactId: string, data: ContactData): Promise<void> {
    try {
      this.logger.log(`[Zoho] Updating contact: ${contactId}`);
      
      const payload = {
        data: [{
          First_Name: data.firstName,
          Last_Name: data.lastName,
          Phone: data.phone
        }]
      };

      await this.axios.put(`/Contacts/${contactId}`, payload);
      
      this.logger.log(`[Zoho] Contact updated: ${contactId}`);
    } catch (error) {
      this.logger.error('[Zoho] Error updating contact:', error.response?.data || error.message);
      throw new Error(`Failed to update Zoho contact: ${error.message}`);
    }
  }

  async getContact(contactId: string): Promise<ContactData> {
    try {
      this.logger.log(`[Zoho] Getting contact: ${contactId}`);
      
      const response = await this.axios.get(`/Contacts/${contactId}`);
      const contacts = response.data.data;
      
      if (!contacts || contacts.length === 0) {
        throw new Error('Contact not found');
      }
      
      const contact: ZohoContact = contacts[0];
      
      return {
        id: contact.id,
        firstName: contact.First_Name,
        lastName: contact.Last_Name,
        email: contact.Email,
        phone: contact.Phone,
        platformId: contactId
      };
    } catch (error) {
      this.logger.error('[Zoho] Error getting contact:', error.response?.data || error.message);
      throw new Error(`Failed to get Zoho contact: ${error.message}`);
    }
  }

  async searchContacts(query: string): Promise<ContactData[]> {
    try {
      this.logger.log(`[Zoho] Searching contacts: ${query}`);
      
      const response = await this.axios.get('/Contacts/search', {
        params: {
          word: query,
          page: 1,
          per_page: 20
        }
      });

      const contacts: ZohoContact[] = response.data.data || [];

      return contacts.map(contact => ({
        id: contact.id,
        firstName: contact.First_Name,
        lastName: contact.Last_Name,
        email: contact.Email,
        phone: contact.Phone,
        platformId: contact.id
      }));
    } catch (error) {
      this.logger.error('[Zoho] Error searching contacts:', error.response?.data || error.message);
      return [];
    }
  }

  async createConversation(conversation: ConversationData): Promise<string> {
    try {
      this.logger.log(`[Zoho] Creating conversation: ${conversation.id}`);
      
      // Zoho usa "Notes" para registrar conversaciones
      const firstMessage = conversation.messages?.[0];
      const messageContent = firstMessage?.message || 'New conversation';
      
      const payload = {
        data: [{
          Note_Title: `Conversation - ${conversation.id}`,
          Note_Content: messageContent
        }]
      };

      // Si hay participantes, asociar con el primer contacto
      if (conversation.participants && conversation.participants.length > 0) {
        payload.data[0]['Parent_Id'] = conversation.participants[0];
      }

      const response = await this.axios.post('/Notes', payload);
      
      this.logger.log(`[Zoho] Conversation created: ${response.data.data[0].details.id}`);
      return response.data.data[0].details.id;
    } catch (error) {
      this.logger.error('[Zoho] Error creating conversation:', error.response?.data || error.message);
      throw new Error(`Failed to create Zoho conversation: ${error.message}`);
    }
  }

  async sendMessage(conversationId: string, message: any): Promise<string> {
    try {
      this.logger.log(`[Zoho] Adding message to conversation: ${conversationId}`);
      
      const payload = {
        data: [{
          Note_Content: message.message || message.content || 'New message'
        }]
      };

      const response = await this.axios.put(`/Notes/${conversationId}`, payload);
      
      this.logger.log(`[Zoho] Message added: ${response.data.data[0].details.id}`);
      return response.data.data[0].details.id;
    } catch (error) {
      this.logger.error('[Zoho] Error sending message:', error.response?.data || error.message);
      throw new Error(`Failed to send Zoho message: ${error.message}`);
    }
  }

  async getConversations(filters?: ConversationFilters): Promise<ConversationData[]> {
    try {
      this.logger.log('[Zoho] Getting conversations/notes...');
      
      const params: any = {
        page: 1,
        per_page: filters?.limit || 25
      };

      const response = await this.axios.get('/Notes', { params });
      const notes = response.data.data || [];

      return notes.map((note: any) => ({
        id: note.id,
        participants: note.Parent_Id ? [note.Parent_Id] : [],
        messages: [{
          id: note.id,
          message: note.Note_Content,
          from: 'system',
          createdAt: new Date(note.Created_Time)
        }],
        createdAt: new Date(note.Created_Time)
      }));
    } catch (error) {
      this.logger.error('[Zoho] Error getting conversations:', error.response?.data || error.message);
      return [];
    }
  }

  async addLabel(contactId: string, label: string): Promise<void> {
    try {
      this.logger.log(`[Zoho] Adding label to contact: ${contactId} - ${label}`);
      
      // Zoho usa "Tags" para etiquetar contactos
      const payload = {
        data: [{
          Tag: [label]
        }]
      };

      await this.axios.post(`/Contacts/${contactId}/Tags`, payload);
      
      this.logger.log(`[Zoho] Label added: ${label}`);
    } catch (error) {
      this.logger.error('[Zoho] Error adding label:', error.response?.data || error.message);
      throw new Error(`Failed to add Zoho label: ${error.message}`);
    }
  }

  async removeLabel(contactId: string, label: string): Promise<void> {
    try {
      this.logger.log(`[Zoho] Removing label from contact: ${contactId} - ${label}`);
      
      // Obtener tags actuales
      const response = await this.axios.get(`/Contacts/${contactId}/Tags`);
      const currentTags = response.data.data || [];
      
      // Encontrar y remover el tag específico
      const tagToRemove = currentTags.find((tag: any) => tag.name === label);
      if (tagToRemove) {
        await this.axios.delete(`/Contacts/${contactId}/Tags/${tagToRemove.id}`);
      }
      
      this.logger.log(`[Zoho] Label removed: ${label}`);
    } catch (error) {
      this.logger.error('[Zoho] Error removing label:', error.response?.data || error.message);
      throw new Error(`Failed to remove Zoho label: ${error.message}`);
    }
  }

  async getLabels(contactId: string): Promise<string[]> {
    try {
      this.logger.log(`[Zoho] Getting labels for contact: ${contactId}`);
      
      const response = await this.axios.get(`/Contacts/${contactId}/Tags`);
      const tags = response.data.data || [];

      return tags.map((tag: any) => tag.name);
    } catch (error) {
      this.logger.error('[Zoho] Error getting labels:', error.response?.data || error.message);
      return [];
    }
  }

  async createLabel(label: string): Promise<string> {
    try {
      this.logger.log(`[Zoho] Creating label: ${label}`);
      
      const payload = {
        data: [{
          name: label
        }]
      };

      const response = await this.axios.post('/Settings/tags', payload);
      
      this.logger.log(`[Zoho] Label created: ${response.data.data[0].details.id}`);
      return response.data.data[0].details.id;
    } catch (error) {
      this.logger.error('[Zoho] Error creating label:', error.response?.data || error.message);
      throw new Error(`Failed to create Zoho label: ${error.message}`);
    }
  }

  // Zoho usa Deals
  async createDeal(deal: any): Promise<string> {
    try {
      this.logger.log(`[Zoho] Creating deal: ${deal.name}`);
      
      const payload = {
        data: [{
          Deal_Name: deal.name,
          Amount: deal.amount,
          Stage: deal.stage || 'Qualification',
          Closing_Date: deal.closeDate ? new Date(deal.closeDate).toISOString().split('T')[0] : 
                          new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] // 30 días por defecto
        }]
      };

      // Si hay un contactId, agregar la asociación
      if (deal.contactId) {
        payload.data[0]['Contact_Name'] = deal.contactId;
      }

      const response = await this.axios.post('/Deals', payload);
      
      this.logger.log(`[Zoho] Deal created: ${response.data.data[0].details.id}`);
      return response.data.data[0].details.id;
    } catch (error) {
      this.logger.error('[Zoho] Error creating deal:', error.response?.data || error.message);
      throw new Error(`Failed to create Zoho deal: ${error.message}`);
    }
  }

  // Método para crear tareas (Tasks en Zoho)
  async createTask(task: TaskData): Promise<string> {
    try {
      this.logger.log(`[Zoho] Creating task: ${task.title}`);
      
      const payload = {
        data: [{
          Subject: task.title,
          Due_Date: task.dueDate.toISOString().split('T')[0],
          Status: 'Not Started',
          Priority: 'Normal'
        }]
      };

      // Si hay un contactId, asignar la tarea al contacto
      if (task.contactId) {
        payload.data[0]['What_Id'] = task.contactId;
      }

      const response = await this.axios.post('/Tasks', payload);
      
      this.logger.log(`[Zoho] Task created: ${response.data.data[0].details.id}`);
      return response.data.data[0].details.id;
    } catch (error) {
      this.logger.error('[Zoho] Error creating task:', error.response?.data || error.message);
      throw new Error(`Failed to create Zoho task: ${error.message}`);
    }
  }

  // Método para crear notas
  async createNote(contactId: string, note: string): Promise<string> {
    try {
      this.logger.log(`[Zoho] Creating note for contact: ${contactId}`);
      
      const payload = {
        data: [{
          Note_Title: 'Note from SYST',
          Note_Content: note,
          Parent_Id: contactId
        }]
      };

      const response = await this.axios.post('/Notes', payload);
      
      this.logger.log(`[Zoho] Note created: ${response.data.data[0].details.id}`);
      return response.data.data[0].details.id;
    } catch (error) {
      this.logger.error('[Zoho] Error creating note:', error.response?.data || error.message);
      throw new Error(`Failed to create Zoho note: ${error.message}`);
    }
  }
}
