import { Injectable, Logger } from '@nestjs/common';
import axios, { AxiosInstance } from 'axios';
import { CRMAdapter, CRMConfig, ContactData, ConversationData, ConversationFilters, DealData, TaskData } from '../interfaces/crm-adapter.interface';

export interface SalesforceContact {
  Id: string;
  FirstName?: string;
  LastName?: string;
  Email?: string;
  Phone?: string;
  CreatedDate: string;
  LastModifiedDate: string;
}

export interface SalesforceOpportunity {
  Id: string;
  Name: string;
  Amount?: number;
  StageName?: string;
  CloseDate?: string;
  CreatedDate: string;
}

@Injectable()
export class SalesforceCrmAdapter implements CRMAdapter {
  private readonly logger = new Logger(SalesforceCrmAdapter.name);
  private accessToken: string;
  private refreshToken: string;
  private clientId: string;
  private clientSecret: string;
  private instanceUrl: string;
  private axios: AxiosInstance;
  private connectionStatus = false;

  async connect(config: CRMConfig): Promise<boolean> {
    try {
      this.logger.log('[Salesforce] Connecting to Salesforce CRM...');
      
      this.accessToken = config.accessToken;
      this.refreshToken = config.refreshToken;
      this.clientId = config.apiKey;
      this.clientSecret = config.apiSecret;
      this.instanceUrl = config.baseUrl;

      // Configurar axios con headers por defecto
      this.axios = axios.create({
        baseURL: this.instanceUrl,
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json'
        },
        timeout: 30000
      });

      // Probar conexión obteniendo información del usuario
      const response = await this.axios.get('/services/data/v56.0/sobjects/Contact/describe');
      
      this.connectionStatus = true;
      this.logger.log('[Salesforce] Successfully connected to Salesforce CRM');
      return true;
    } catch (error) {
      this.logger.error('[Salesforce] Connection failed:', error.response?.data || error.message);
      
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
    this.instanceUrl = null;
    this.axios = null;
    this.connectionStatus = false;
    this.logger.log('[Salesforce] Disconnected from Salesforce CRM');
  }

  async isConnected(): Promise<boolean> {
    return this.connectionStatus && !!this.accessToken;
  }

  private async refreshAccessToken(): Promise<boolean> {
    try {
      this.logger.log('[Salesforce] Refreshing access token...');
      
      const response = await axios.post(`${this.instanceUrl}/services/oauth2/token`, {
        grant_type: 'refresh_token',
        refresh_token: this.refreshToken,
        client_id: this.clientId,
        client_secret: this.clientSecret
      });

      this.accessToken = response.data.access_token;
      
      // Actualizar axios con nuevo token
      if (this.axios) {
        this.axios.defaults.headers['Authorization'] = `Bearer ${this.accessToken}`;
      }

      this.logger.log('[Salesforce] Access token refreshed successfully');
      return true;
    } catch (error) {
      this.logger.error('[Salesforce] Failed to refresh access token:', error.message);
      return false;
    }
  }

  async createContact(contact: ContactData): Promise<string> {
    try {
      this.logger.log(`[Salesforce] Creating contact: ${contact.email}`);
      
      const payload = {
        FirstName: contact.firstName || '',
        LastName: contact.lastName || 'Unknown',
        Email: contact.email,
        Phone: contact.phone
      };

      const response = await this.axios.post('/services/data/v56.0/sobjects/Contact', payload);
      
      this.logger.log(`[Salesforce] Contact created: ${response.data.id}`);
      return response.data.id;
    } catch (error) {
      this.logger.error('[Salesforce] Error creating contact:', error.response?.data || error.message);
      throw new Error(`Failed to create Salesforce contact: ${error.message}`);
    }
  }

  async updateContact(contactId: string, data: ContactData): Promise<void> {
    try {
      this.logger.log(`[Salesforce] Updating contact: ${contactId}`);
      
      const payload = {
        FirstName: data.firstName,
        LastName: data.lastName,
        Phone: data.phone
      };

      await this.axios.patch(`/services/data/v56.0/sobjects/Contact/${contactId}`, payload);
      
      this.logger.log(`[Salesforce] Contact updated: ${contactId}`);
    } catch (error) {
      this.logger.error('[Salesforce] Error updating contact:', error.response?.data || error.message);
      throw new Error(`Failed to update Salesforce contact: ${error.message}`);
    }
  }

  async getContact(contactId: string): Promise<ContactData> {
    try {
      this.logger.log(`[Salesforce] Getting contact: ${contactId}`);
      
      const response = await this.axios.get(`/services/data/v56.0/sobjects/Contact/${contactId}`);
      const contact: SalesforceContact = response.data;
      
      return {
        id: contact.Id,
        firstName: contact.FirstName,
        lastName: contact.LastName,
        email: contact.Email,
        phone: contact.Phone,
        platformId: contactId
      };
    } catch (error) {
      this.logger.error('[Salesforce] Error getting contact:', error.response?.data || error.message);
      throw new Error(`Failed to get Salesforce contact: ${error.message}`);
    }
  }

  async searchContacts(query: string): Promise<ContactData[]> {
    try {
      this.logger.log(`[Salesforce] Searching contacts: ${query}`);
      
      const soqlQuery = `
        SELECT Id, FirstName, LastName, Email, Phone 
        FROM Contact 
        WHERE FirstName LIKE '%${query}%' 
        OR LastName LIKE '%${query}%' 
        OR Email LIKE '%${query}%'
        LIMIT 20
      `;

      const response = await this.axios.get(`/services/data/v56.0/query?q=${encodeURIComponent(soqlQuery)}`);
      const contacts: SalesforceContact[] = response.data.records || [];

      return contacts.map(contact => ({
        id: contact.Id,
        firstName: contact.FirstName,
        lastName: contact.LastName,
        email: contact.Email,
        phone: contact.Phone,
        platformId: contact.Id
      }));
    } catch (error) {
      this.logger.error('[Salesforce] Error searching contacts:', error.response?.data || error.message);
      return [];
    }
  }

  async createConversation(conversation: ConversationData): Promise<string> {
    try {
      this.logger.log(`[Salesforce] Creating conversation: ${conversation.id}`);
      
      // Salesforce usa "Tasks" para registrar conversaciones
      const firstMessage = conversation.messages?.[0];
      const messageContent = firstMessage?.message || 'New conversation';
      
      const payload = {
        Subject: `Conversation - ${conversation.id}`,
        Description: messageContent,
        Status: 'Completed',
        Priority: 'Normal'
      };

      // Si hay participantes, asignar al primer contacto
      if (conversation.participants && conversation.participants.length > 0) {
        payload['WhoId'] = conversation.participants[0];
      }

      const response = await this.axios.post('/services/data/v56.0/sobjects/Task', payload);
      
      this.logger.log(`[Salesforce] Conversation created: ${response.data.id}`);
      return response.data.id;
    } catch (error) {
      this.logger.error('[Salesforce] Error creating conversation:', error.response?.data || error.message);
      throw new Error(`Failed to create Salesforce conversation: ${error.message}`);
    }
  }

  async sendMessage(conversationId: string, message: any): Promise<string> {
    try {
      this.logger.log(`[Salesforce] Adding message to conversation: ${conversationId}`);
      
      const payload = {
        Description: message.message || message.content || 'New message',
        Status: 'Completed'
      };

      const response = await this.axios.patch(`/services/data/v56.0/sobjects/Task/${conversationId}`, payload);
      
      this.logger.log(`[Salesforce] Message added: ${response.data.id}`);
      return response.data.id;
    } catch (error) {
      this.logger.error('[Salesforce] Error sending message:', error.response?.data || error.message);
      throw new Error(`Failed to send Salesforce message: ${error.message}`);
    }
  }

  async getConversations(filters?: ConversationFilters): Promise<ConversationData[]> {
    try {
      this.logger.log('[Salesforce] Getting conversations/tasks...');
      
      let soqlQuery = `
        SELECT Id, Subject, Description, WhoId, CreatedDate 
        FROM Task 
        WHERE Subject LIKE 'Conversation - %'
      `;

      if (filters?.limit) {
        soqlQuery += ` LIMIT ${filters.limit}`;
      }

      const response = await this.axios.get(`/services/data/v56.0/query?q=${encodeURIComponent(soqlQuery)}`);
      const tasks = response.data.records || [];

      return tasks.map((task: any) => ({
        id: task.Id,
        participants: task.WhoId ? [task.WhoId] : [],
        messages: [{
          id: task.Id,
          message: task.Description,
          from: 'system',
          createdAt: new Date(task.CreatedDate)
        }],
        createdAt: new Date(task.CreatedDate)
      }));
    } catch (error) {
      this.logger.error('[Salesforce] Error getting conversations:', error.response?.data || error.message);
      return [];
    }
  }

  async addLabel(contactId: string, label: string): Promise<void> {
    try {
      this.logger.log(`[Salesforce] Adding label to contact: ${contactId} - ${label}`);
      
      // Salesforce usa campos personalizados o "Tags" para etiquetas
      // Aquí usamos el campo Description para agregar etiquetas
      const response = await this.axios.get(`/services/data/v56.0/sobjects/Contact/${contactId}`);
      const currentDescription = response.data.Description || '';
      
      const updatedDescription = currentDescription 
        ? `${currentDescription}\nTags: ${label}`
        : `Tags: ${label}`;

      await this.axios.patch(`/services/data/v56.0/sobjects/Contact/${contactId}`, {
        Description: updatedDescription
      });
      
      this.logger.log(`[Salesforce] Label added: ${label}`);
    } catch (error) {
      this.logger.error('[Salesforce] Error adding label:', error.response?.data || error.message);
      throw new Error(`Failed to add Salesforce label: ${error.message}`);
    }
  }

  async removeLabel(contactId: string, label: string): Promise<void> {
    try {
      this.logger.log(`[Salesforce] Removing label from contact: ${contactId} - ${label}`);
      
      const response = await this.axios.get(`/services/data/v56.0/sobjects/Contact/${contactId}`);
      const currentDescription = response.data.Description || '';
      
      // Remover la etiqueta específica
      const updatedDescription = currentDescription
        .replace(`Tags: ${label}`, '')
        .replace(`\nTags: ${label}`, '')
        .trim();

      await this.axios.patch(`/services/data/v56.0/sobjects/Contact/${contactId}`, {
        Description: updatedDescription
      });
      
      this.logger.log(`[Salesforce] Label removed: ${label}`);
    } catch (error) {
      this.logger.error('[Salesforce] Error removing label:', error.response?.data || error.message);
      throw new Error(`Failed to remove Salesforce label: ${error.message}`);
    }
  }

  async getLabels(contactId: string): Promise<string[]> {
    try {
      this.logger.log(`[Salesforce] Getting labels for contact: ${contactId}`);
      
      const response = await this.axios.get(`/services/data/v56.0/sobjects/Contact/${contactId}`);
      const description = response.data.Description || '';
      
      // Extraer etiquetas del campo Description
      const tagsMatch = description.match(/Tags: (.+?)(?:\n|$)/);
      if (tagsMatch) {
        return tagsMatch[1].split(',').map(tag => tag.trim());
      }
      
      return [];
    } catch (error) {
      this.logger.error('[Salesforce] Error getting labels:', error.response?.data || error.message);
      return [];
    }
  }

  async createLabel(label: string): Promise<string> {
    try {
      this.logger.log(`[Salesforce] Creating label: ${label}`);
      
      // Salesforce no tiene un concepto directo de "etiquetas" globales
      // Las etiquetas se manejan como campos personalizados o en el Description
      this.logger.warn(`[Salesforce] Label creation handled through contact Description field: ${label}`);
      
      return label;
    } catch (error) {
      this.logger.error('[Salesforce] Error creating label:', error.message);
      throw new Error(`Failed to create Salesforce label: ${error.message}`);
    }
  }

  // Salesforce usa Opportunities en lugar de Deals
  async createDeal(deal: any): Promise<string> {
    try {
      this.logger.log(`[Salesforce] Creating opportunity: ${deal.name}`);
      
      const payload = {
        Name: deal.name,
        Amount: deal.amount,
        StageName: deal.stage || 'Prospecting',
        CloseDate: deal.closeDate ? new Date(deal.closeDate).toISOString().split('T')[0] : 
                   new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] // 30 días por defecto
      };

      // Si hay un contactId, agregar la asociación
      if (deal.contactId) {
        // En Salesforce, las oportunidades se asocian a través de OpportunityContactRole
        // Primero creamos la oportunidad
        const opportunityResponse = await this.axios.post('/services/data/v56.0/sobjects/Opportunity', payload);
        const opportunityId = opportunityResponse.data.id;
        
        // Luego creamos la relación con el contacto
        const rolePayload = {
          OpportunityId: opportunityId,
          ContactId: deal.contactId,
          Role: 'Decision Maker'
        };
        
        await this.axios.post('/services/data/v56.0/sobjects/OpportunityContactRole', rolePayload);
        
        this.logger.log(`[Salesforce] Opportunity created: ${opportunityId}`);
        return opportunityId;
      } else {
        const response = await this.axios.post('/services/data/v56.0/sobjects/Opportunity', payload);
        this.logger.log(`[Salesforce] Opportunity created: ${response.data.id}`);
        return response.data.id;
      }
    } catch (error) {
      this.logger.error('[Salesforce] Error creating opportunity:', error.response?.data || error.message);
      throw new Error(`Failed to create Salesforce opportunity: ${error.message}`);
    }
  }

  // Método para crear tareas (Tasks en Salesforce)
  async createTask(task: TaskData): Promise<string> {
    try {
      this.logger.log(`[Salesforce] Creating task: ${task.title}`);
      
      const payload = {
        Subject: task.title,
        ActivityDate: task.dueDate.toISOString().split('T')[0],
        Status: 'Not Started',
        Priority: 'Normal'
      };

      // Si hay un contactId, asignar la tarea al contacto
      if (task.contactId) {
        payload['WhoId'] = task.contactId;
      }

      const response = await this.axios.post('/services/data/v56.0/sobjects/Task', payload);
      
      this.logger.log(`[Salesforce] Task created: ${response.data.id}`);
      return response.data.id;
    } catch (error) {
      this.logger.error('[Salesforce] Error creating task:', error.response?.data || error.message);
      throw new Error(`Failed to create Salesforce task: ${error.message}`);
    }
  }

  // Método para crear notas
  async createNote(contactId: string, note: string): Promise<string> {
    try {
      this.logger.log(`[Salesforce] Creating note for contact: ${contactId}`);
      
      const payload = {
        Title: 'Note from SYST',
        Body: note,
        ParentId: contactId
      };

      const response = await this.axios.post('/services/data/v56.0/sobjects/Note', payload);
      
      this.logger.log(`[Salesforce] Note created: ${response.data.id}`);
      return response.data.id;
    } catch (error) {
      this.logger.error('[Salesforce] Error creating note:', error.response?.data || error.message);
      throw new Error(`Failed to create Salesforce note: ${error.message}`);
    }
  }
}
