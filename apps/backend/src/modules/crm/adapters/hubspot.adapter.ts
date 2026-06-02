import { Injectable, Logger } from '@nestjs/common';
import axios, { AxiosInstance } from 'axios';
import { CRMAdapter, CRMConfig, ContactData, ConversationData, ConversationFilters } from '../interfaces/crm-adapter.interface';

export interface HubSpotContact {
  id: string;
  properties: {
    email?: string;
    phone?: string;
    firstname?: string;
    lastname?: string;
    hs_lead_status?: string;
    lifecyclestage?: string;
  };
  createdAt: string;
  updatedAt: string;
}

export interface HubSpotDeal {
  id: string;
  properties: {
    dealname?: string;
    amount?: string;
    dealstage?: string;
    pipeline?: string;
    closedate?: string;
  };
  associations?: {
    contacts?: {
      results: Array<{ id: string; type: string }>;
    };
  };
}

@Injectable()
export class HubspotCrmAdapter implements CRMAdapter {
  private readonly logger = new Logger(HubspotCrmAdapter.name);
  private accessToken: string;
  private refreshToken: string;
  private clientId: string;
  private clientSecret: string;
  private axios: AxiosInstance;
  private connectionStatus = false;

  async connect(config: CRMConfig): Promise<boolean> {
    try {
      this.logger.log('[HubSpot] Connecting to HubSpot CRM...');
      
      this.accessToken = config.accessToken;
      this.refreshToken = config.refreshToken;
      this.clientId = config.apiKey;
      this.clientSecret = config.apiSecret;

      // Configurar axios con headers por defecto
      this.axios = axios.create({
        baseURL: 'https://api.hubapi.com',
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json'
        },
        timeout: 30000
      });

      // Probar conexión obteniendo información del portal
      const response = await this.axios.get('/crm/v3/objects/contacts?limit=1');
      
      this.connectionStatus = true;
      this.logger.log('[HubSpot] Successfully connected to HubSpot CRM');
      return true;
    } catch (error) {
      this.logger.error('[HubSpot] Connection failed:', error.response?.data || error.message);
      
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
    this.logger.log('[HubSpot] Disconnected from HubSpot CRM');
  }

  async isConnected(): Promise<boolean> {
    return this.connectionStatus && !!this.accessToken;
  }

  private async refreshAccessToken(): Promise<boolean> {
    try {
      this.logger.log('[HubSpot] Refreshing access token...');
      
      const response = await axios.post('https://api.hubapi.com/oauth/v1/token', {
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

      this.logger.log('[HubSpot] Access token refreshed successfully');
      return true;
    } catch (error) {
      this.logger.error('[HubSpot] Failed to refresh access token:', error.message);
      return false;
    }
  }

  async createContact(contact: ContactData): Promise<string> {
    try {
      this.logger.log(`[HubSpot] Creating contact: ${contact.email}`);
      
      const firstName = contact.firstName || '';
      const lastName = contact.lastName || '';
      
      const payload = {
        properties: {
          email: contact.email,
          phone: contact.phone,
          firstname: firstName,
          lastname: lastName,
          hs_lead_status: 'NEW',
          lifecyclestage: 'lead'
        }
      };

      const response = await this.axios.post('/crm/v3/objects/contacts', payload);
      
      this.logger.log(`[HubSpot] Contact created: ${response.data.id}`);
      return response.data.id;
    } catch (error) {
      this.logger.error('[HubSpot] Error creating contact:', error.response?.data || error.message);
      throw new Error(`Failed to create HubSpot contact: ${error.message}`);
    }
  }

  async updateContact(contactId: string, data: ContactData): Promise<void> {
    try {
      this.logger.log(`[HubSpot] Updating contact: ${contactId}`);
      
      const firstName = data.firstName || '';
      const lastName = data.lastName || '';
      
      const payload = {
        properties: {
          phone: data.phone,
          firstname: firstName,
          lastname: lastName
        }
      };

      await this.axios.patch(`/crm/v3/objects/contacts/${contactId}`, payload);
      
      this.logger.log(`[HubSpot] Contact updated: ${contactId}`);
    } catch (error) {
      this.logger.error('[HubSpot] Error updating contact:', error.response?.data || error.message);
      throw new Error(`Failed to update HubSpot contact: ${error.message}`);
    }
  }

  async getContact(contactId: string): Promise<ContactData> {
    try {
      this.logger.log(`[HubSpot] Getting contact: ${contactId}`);
      
      const response = await this.axios.get(`/crm/v3/objects/contacts/${contactId}`);
      const contact: HubSpotContact = response.data;
      
      return {
        id: contact.id,
        email: contact.properties.email,
        phone: contact.properties.phone,
        firstName: contact.properties.firstname,
        lastName: contact.properties.lastname,
        platformId: contactId
      };
    } catch (error) {
      this.logger.error('[HubSpot] Error getting contact:', error.response?.data || error.message);
      throw new Error(`Failed to get HubSpot contact: ${error.message}`);
    }
  }

  async searchContacts(query: string): Promise<ContactData[]> {
    try {
      this.logger.log(`[HubSpot] Searching contacts: ${query}`);
      
      const response = await this.axios.post('/crm/v3/objects/contacts/search', {
        query: query,
        limit: 20,
        properties: ['email', 'phone', 'firstname', 'lastname', 'hs_lead_status']
      });

      const contacts: HubSpotContact[] = response.data.results || [];
      
      return contacts.map(contact => ({
        id: contact.id,
        email: contact.properties.email,
        phone: contact.properties.phone,
        firstName: contact.properties.firstname,
        lastName: contact.properties.lastname,
        platformId: contact.id
      }));
    } catch (error) {
      this.logger.error('[HubSpot] Error searching contacts:', error.response?.data || error.message);
      return [];
    }
  }

  async createConversation(conversation: ConversationData): Promise<string> {
    try {
      this.logger.log(`[HubSpot] Creating conversation: ${conversation.id}`);
      
      // HubSpot no tiene un concepto directo de "conversaciones" como otros CRMs
      // En su lugar, creamos una nota o actividad asociada al contacto
      const firstMessage = conversation.messages?.[0];
      const messageContent = firstMessage?.message || 'New conversation';
      
      const payload = {
        properties: {
          hs_note_body: messageContent,
          hs_timestamp: Date.now().toString()
        },
        associations: []
      };
      
      // Si hay participantes, asociar con el primer contacto
      if (conversation.participants && conversation.participants.length > 0) {
        payload.associations.push({
          to: { id: conversation.participants[0] },
          types: [{ associationCategory: 'HUBSPOT_ASSOCIATION', associationTypeId: 202 }]
        });
      }

      const response = await this.axios.post('/crm/v3/objects/notes', payload);
      
      this.logger.log(`[HubSpot] Conversation created: ${response.data.id}`);
      return response.data.id;
    } catch (error) {
      this.logger.error('[HubSpot] Error creating conversation:', error.response?.data || error.message);
      throw new Error(`Failed to create HubSpot conversation: ${error.message}`);
    }
  }

  async sendMessage(conversationId: string, message: any): Promise<string> {
    try {
      this.logger.log(`[HubSpot] Adding message to conversation: ${conversationId}`);
      
      const payload = {
        properties: {
          hs_note_body: message.message || message.content || 'New message',
          hs_timestamp: Date.now().toString()
        }
      };

      const response = await this.axios.patch(`/crm/v3/objects/notes/${conversationId}`, payload);
      
      this.logger.log(`[HubSpot] Message added: ${response.data.id}`);
      return response.data.id;
    } catch (error) {
      this.logger.error('[HubSpot] Error sending message:', error.response?.data || error.message);
      throw new Error(`Failed to send HubSpot message: ${error.message}`);
    }
  }

  async getConversations(filters?: ConversationFilters): Promise<ConversationData[]> {
    try {
      this.logger.log('[HubSpot] Getting conversations/notes...');
      
      const url = '/crm/v3/objects/notes';
      const params: any = {
        limit: filters?.limit || 25,
        properties: ['hs_note_body', 'hs_timestamp']
      };

      const response = await this.axios.get(url, { params });
      const notes = response.data.results || [];

      return notes.map((note: any) => ({
        id: note.id,
        participants: note.associations?.contacts?.results?.map((c: any) => c.id) || [],
        messages: [{
          id: note.id,
          message: note.properties.hs_note_body,
          from: 'system',
          createdAt: new Date(parseInt(note.properties.hs_timestamp))
        }],
        createdAt: new Date(parseInt(note.properties.hs_timestamp))
      }));
    } catch (error) {
      this.logger.error('[HubSpot] Error getting conversations:', error.response?.data || error.message);
      return [];
    }
  }

  async addLabel(contactId: string, label: string): Promise<void> {
    try {
      this.logger.log(`[HubSpot] Adding label to contact: ${contactId} - ${label}`);
      
      // En HubSpot, las etiquetas se manejan como propiedades o lifecycle stages
      const payload = {
        properties: {
          hs_lead_status: label,
          lifecyclestage: this.mapLabelToLifecycleStage(label)
        }
      };

      await this.axios.patch(`/crm/v3/objects/contacts/${contactId}`, payload);
      
      this.logger.log(`[HubSpot] Label added: ${label}`);
    } catch (error) {
      this.logger.error('[HubSpot] Error adding label:', error.response?.data || error.message);
      throw new Error(`Failed to add HubSpot label: ${error.message}`);
    }
  }

  async removeLabel(contactId: string, label: string): Promise<void> {
    try {
      this.logger.log(`[HubSpot] Removing label from contact: ${contactId} - ${label}`);
      
      const payload = {
        properties: {
          hs_lead_status: 'OPEN',
          lifecyclestage: 'lead'
        }
      };

      await this.axios.patch(`/crm/v3/objects/contacts/${contactId}`, payload);
      
      this.logger.log(`[HubSpot] Label removed: ${label}`);
    } catch (error) {
      this.logger.error('[HubSpot] Error removing label:', error.response?.data || error.message);
      throw new Error(`Failed to remove HubSpot label: ${error.message}`);
    }
  }

  async getLabels(contactId: string): Promise<string[]> {
    try {
      this.logger.log(`[HubSpot] Getting labels for contact: ${contactId}`);
      
      const response = await this.axios.get(`/crm/v3/objects/contacts/${contactId}`, {
        params: {
          properties: ['hs_lead_status', 'lifecyclestage']
        }
      });

      const contact = response.data;
      const labels: string[] = [];

      if (contact.properties.hs_lead_status) {
        labels.push(contact.properties.hs_lead_status);
      }
      
      if (contact.properties.lifecyclestage) {
        labels.push(contact.properties.lifecyclestage);
      }

      return labels;
    } catch (error) {
      this.logger.error('[HubSpot] Error getting labels:', error.response?.data || error.message);
      return [];
    }
  }

  async createLabel(label: string): Promise<string> {
    try {
      this.logger.log(`[HubSpot] Creating label: ${label}`);
      
      // En HubSpot, las etiquetas se configuran como propiedades personalizadas
      // Esto requiere configuración adicional en el portal de HubSpot
      this.logger.warn(`[HubSpot] Label creation requires manual setup in HubSpot portal: ${label}`);
      
      return label;
    } catch (error) {
      this.logger.error('[HubSpot] Error creating label:', error.message);
      throw new Error(`Failed to create HubSpot label: ${error.message}`);
    }
  }

  // Método para crear deals (oportunidades de venta)
  async createDeal(deal: any): Promise<string> {
    try {
      this.logger.log(`[HubSpot] Creating deal: ${deal.name}`);
      
      const payload: any = {
        properties: {
          dealname: deal.name,
          amount: deal.amount ? deal.amount.toString() : undefined,
          dealstage: deal.stage || 'appointmentscheduled',
          pipeline: 'default',
          closedate: deal.closeDate ? new Date(deal.closeDate).toISOString().split('T')[0] : undefined
        }
      };

      // Si hay un contactId, agregar la asociación
      if (deal.contactId) {
        payload.associations = [
          {
            to: { id: deal.contactId },
            types: [{ associationCategory: 'HUBSPOT_ASSOCIATION', associationTypeId: 3 }]
          }
        ];
      }

      const response = await this.axios.post('/crm/v3/objects/deals', payload);
      
      this.logger.log(`[HubSpot] Deal created: ${response.data.id}`);
      return response.data.id;
    } catch (error) {
      this.logger.error('[HubSpot] Error creating deal:', error.response?.data || error.message);
      throw new Error(`Failed to create HubSpot deal: ${error.message}`);
    }
  }

  private mapLabelToLifecycleStage(label: string): string {
    const labelMap: Record<string, string> = {
      'NEW': 'lead',
      'OPEN': 'lead',
      'CONTACTED': 'lead',
      'QUALIFIED': 'marketingqualifiedlead',
      'CONVERTED': 'salesqualifiedlead',
      'CLOSED_WON': 'customer',
      'CLOSED_LOST': 'evangelist'
    };
    
    return labelMap[label] || 'lead';
  }
}
