import { Injectable, Logger } from '@nestjs/common';
import axios, { AxiosInstance } from 'axios';
import { CRMAdapter, CRMConfig, ContactData, ConversationData, ConversationFilters, DealData, TaskData } from '../interfaces/crm-adapter.interface';

@Injectable()
export class MondayCrmAdapter implements CRMAdapter {
  private readonly logger = new Logger(MondayCrmAdapter.name);
  private apiToken: string;
  private connectionStatus = false;
  private axios: AxiosInstance;
  private defaultBoardId: string;

  async connect(config: CRMConfig): Promise<boolean> {
    try {
      this.logger.log('[Monday] Connecting to Monday.com API...');
      
      this.apiToken = config.apiKey || config.accessToken || config.config?.apiToken;
      this.defaultBoardId = config.config?.boardId; // Optional configured Board ID

      if (!this.apiToken) {
        this.logger.error('[Monday] Connection failed: Missing API Token');
        return false;
      }

      this.axios = axios.create({
        baseURL: 'https://api.monday.com/v2',
        headers: {
          'Authorization': this.apiToken,
          'Content-Type': 'application/json',
          'API-Version': '2023-10',
        },
        timeout: 15000,
      });

      // Test connection with a simple GraphQL query checking the current user info
      const query = {
        query: 'query { me { id name email } }',
      };

      const response = await this.axios.post('', query);
      
      if (response.data?.errors) {
        this.logger.error('[Monday] GraphQL errors:', response.data.errors);
        return false;
      }

      const me = response.data?.data?.me;
      this.connectionStatus = !!me;
      
      if (this.connectionStatus) {
        this.logger.log(`[Monday] Successfully connected to Monday.com as ${me.name} (${me.email})`);
        
        // Ensure a board exists for leads if none is explicitly configured
        if (!this.defaultBoardId) {
          await this.ensureLeadsBoardExists();
        }
      }

      return this.connectionStatus;
    } catch (error: any) {
      this.logger.error('[Monday] Connection failed:', error.response?.data || error.message);
      return false;
    }
  }

  private async ensureLeadsBoardExists(): Promise<void> {
    try {
      // Look for a board named "Sybot Enterprise Leads"
      const findQuery = {
        query: 'query { boards (limit: 50) { id name } }',
      };
      const response = await this.axios.post('', findQuery);
      const boards = response.data?.data?.boards || [];
      const existing = boards.find((b: any) => b.name === 'Sybot Enterprise Leads');
      
      if (existing) {
        this.defaultBoardId = existing.id;
        this.logger.log(`[Monday] Using existing Leads Board with ID: ${this.defaultBoardId}`);
      } else {
        // Create new board
        const createMutation = {
          query: 'mutation { create_board (board_name: "Sybot Enterprise Leads", board_kind: public) { id } }',
        };
        const createRes = await this.axios.post('', createMutation);
        const newBoardId = createRes.data?.data?.create_board?.id;
        if (newBoardId) {
          this.defaultBoardId = newBoardId;
          this.logger.log(`[Monday] Created new Leads Board with ID: ${this.defaultBoardId}`);
          
          // Add standard column structure in Monday for email/phone if possible
          // In monday, we create columns like email and phone
          const createEmailCol = {
            query: `mutation { create_column (board_id: ${this.defaultBoardId}, title: "Email", column_type: text) { id } }`
          };
          const createPhoneCol = {
            query: `mutation { create_column (board_id: ${this.defaultBoardId}, title: "Teléfono", column_type: text) { id } }`
          };
          await this.axios.post('', createEmailCol);
          await this.axios.post('', createPhoneCol);
        }
      }
    } catch (err: any) {
      this.logger.warn(`[Monday] Could not ensure Leads Board exists, fallback to first board: ${err.message}`);
    }
  }

  async disconnect(): Promise<void> {
    this.apiToken = null;
    this.axios = null;
    this.connectionStatus = false;
    this.logger.log('[Monday] Disconnected from Monday.com');
  }

  async isConnected(): Promise<boolean> {
    return this.connectionStatus && !!this.apiToken;
  }

  async createContact(contact: ContactData): Promise<string> {
    try {
      if (!this.isConnected()) throw new Error('Not connected to Monday.com');

      const name = `${contact.firstName || ''} ${contact.lastName || ''}`.trim() || 'Sin Nombre';
      this.logger.log(`[Monday] Creating item (contact): ${name}`);

      // If no board is resolved, get the first available board
      if (!this.defaultBoardId) {
        const boardsRes = await this.axios.post('', { query: 'query { boards (limit: 1) { id } }' });
        this.defaultBoardId = boardsRes.data?.data?.boards?.[0]?.id;
        if (!this.defaultBoardId) throw new Error('No boards available on Monday account');
      }

      // Column values map: email and phone text inputs
      const columnValues = JSON.stringify({
        email: contact.email || '',
        phone: contact.phone || '',
      });

      const query = {
        query: `mutation {
          create_item (
            board_id: ${this.defaultBoardId}, 
            item_name: "${name.replace(/"/g, '\\"')}", 
            column_values: "${columnValues.replace(/"/g, '\\"')}"
          ) { id }
        }`,
      };

      const response = await this.axios.post('', query);
      if (response.data?.errors) {
        throw new Error(JSON.stringify(response.data.errors));
      }

      const itemId = response.data?.data?.create_item?.id;
      this.logger.log(`[Monday] Lead item created successfully with ID: ${itemId}`);
      return itemId ? itemId.toString() : '';
    } catch (error: any) {
      this.logger.error('[Monday] Error creating contact:', error.response?.data || error.message);
      throw new Error(`Failed to create Monday item: ${error.message}`);
    }
  }

  async updateContact(contactId: string, data: ContactData): Promise<void> {
    try {
      if (!this.isConnected()) throw new Error('Not connected to Monday.com');
      this.logger.log(`[Monday] Updating item ID: ${contactId}`);

      const columnValues = JSON.stringify({
        email: data.email || '',
        phone: data.phone || '',
      });

      const query = {
        query: `mutation {
          change_multiple_column_values (
            board_id: ${this.defaultBoardId},
            item_id: ${contactId},
            column_values: "${columnValues.replace(/"/g, '\\"')}"
          ) { id }
        }`,
      };

      await this.axios.post('', query);
      this.logger.log(`[Monday] Item ${contactId} updated successfully`);
    } catch (error: any) {
      this.logger.error('[Monday] Error updating contact:', error.response?.data || error.message);
    }
  }

  async getContact(contactId: string): Promise<ContactData> {
    try {
      if (!this.isConnected()) throw new Error('Not connected to Monday.com');

      const query = {
        query: `query { items (ids: [${contactId}]) { id name column_values { id text } } }`,
      };

      const response = await this.axios.post('', query);
      const item = response.data?.data?.items?.[0];

      if (!item) throw new Error('Item not found');

      return {
        id: item.id.toString(),
        firstName: item.name,
        email: item.column_values?.find((c: any) => c.id === 'email')?.text || '',
        phone: item.column_values?.find((c: any) => c.id === 'phone')?.text || '',
      };
    } catch (error: any) {
      this.logger.error('[Monday] Error getting contact:', error.response?.data || error.message);
      throw new Error(`Failed to get Monday item: ${error.message}`);
    }
  }

  async searchContacts(query: string): Promise<ContactData[]> {
    return [];
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
    this.logger.log(`[Monday] Adding update note/label ${label} to item ${contactId}`);
    try {
      const query = {
        query: `mutation { create_update (item_id: ${contactId}, body: "Etiqueta asignada: ${label}") { id } }`,
      };
      await this.axios.post('', query);
    } catch (err: any) {
      this.logger.error(`[Monday] Error adding label as update: ${err.message}`);
    }
  }

  async removeLabel(contactId: string, label: string): Promise<void> {
    this.logger.log(`[Monday] Removing label ${label} from item ${contactId} (no-op)`);
  }

  async getLabels(contactId: string): Promise<string[]> {
    return [];
  }

  async createLabel(label: string): Promise<string> {
    return label;
  }

  async createDeal(deal: DealData): Promise<string> {
    try {
      if (!this.isConnected()) throw new Error('Not connected to Monday.com');
      this.logger.log(`[Monday] Creating deal item: ${deal.name}`);

      const name = `Negocio: ${deal.name} (${deal.stage})`;
      
      const query = {
        query: `mutation {
          create_item (
            board_id: ${this.defaultBoardId}, 
            item_name: "${name.replace(/"/g, '\\"')}"
          ) { id }
        }`,
      };

      const response = await this.axios.post('', query);
      const itemId = response.data?.data?.create_item?.id;

      // Add update note with deal details
      if (itemId) {
        const updateQuery = {
          query: `mutation {
            create_update (
              item_id: ${itemId}, 
              body: "Detalles del Deal:\\n- Temperatura: ${deal.temperature || 'Frío'}\\n- Etapa: ${deal.stage}\\n- Monto: $${deal.amount || 0}\\n- Notas: ${deal.notes || ''}"
            ) { id }
          }`,
        };
        await this.axios.post('', updateQuery);
      }

      return itemId ? itemId.toString() : '';
    } catch (error: any) {
      this.logger.error('[Monday] Error creating deal:', error.response?.data || error.message);
      throw new Error(`Failed to create Monday deal: ${error.message}`);
    }
  }

  async createTask(task: TaskData): Promise<string> {
    try {
      if (!this.isConnected()) throw new Error('Not connected to Monday.com');
      this.logger.log(`[Monday] Creating task item: ${task.title}`);

      const query = {
        query: `mutation {
          create_item (
            board_id: ${this.defaultBoardId}, 
            item_name: "Tarea: ${task.title.replace(/"/g, '\\"')}"
          ) { id }
        }`,
      };

      const response = await this.axios.post('', query);
      const itemId = response.data?.data?.create_item?.id;

      if (itemId && task.dueDate) {
        const updateQuery = {
          query: `mutation {
            create_update (
              item_id: ${itemId}, 
              body: "Fecha límite de tarea: ${new Date(task.dueDate).toLocaleString()}"
            ) { id }
          }`,
        };
        await this.axios.post('', updateQuery);
      }

      return itemId ? itemId.toString() : '';
    } catch (error: any) {
      this.logger.error('[Monday] Error creating task:', error.response?.data || error.message);
      throw new Error(`Failed to create Monday task: ${error.message}`);
    }
  }
}
