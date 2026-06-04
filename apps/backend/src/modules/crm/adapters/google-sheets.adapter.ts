import { Injectable, Logger } from '@nestjs/common';
import { google } from 'googleapis';
import { CRMAdapter, CRMConfig, ContactData, ConversationData, ConversationFilters, DealData, TaskData } from '../interfaces/crm-adapter.interface';

@Injectable()
export class GoogleSheetsAdapter implements CRMAdapter {
  private readonly logger = new Logger(GoogleSheetsAdapter.name);
  private spreadsheetId: string;
  private apiKey: string; // contains the service account JSON
  private isConfigured = false;
  private sheets: any;

  async connect(config: CRMConfig): Promise<boolean> {
    this.spreadsheetId = config.config?.spreadsheetId;
    this.apiKey = config.accessToken; // Google Service Account credentials string (JSON)
    
    if (!this.spreadsheetId) {
      this.logger.error('[GoogleSheets] Connection failed: Missing Spreadsheet ID');
      return false;
    }

    if (!this.apiKey) {
      this.logger.error('[GoogleSheets] Connection failed: Missing credentials (accessToken)');
      return false;
    }

    try {
      let credentials;
      try {
        credentials = JSON.parse(this.apiKey);
      } catch (err) {
        this.logger.error('[GoogleSheets] Connection failed: credentials are not valid JSON');
        return false;
      }

      const auth = new google.auth.GoogleAuth({
        credentials,
        scopes: ['https://www.googleapis.com/auth/spreadsheets'],
      });
      
      this.sheets = google.sheets({ version: 'v4', auth });
      
      // Verify connection by fetching spreadsheet metadata
      await this.sheets.spreadsheets.get({
        spreadsheetId: this.spreadsheetId,
      });

      this.isConfigured = true;
      this.logger.log(`[GoogleSheets] Connected successfully to Spreadsheet ID: ${this.spreadsheetId}`);
      
      // Auto-create/validate sheets (e.g. "Contactos", "Deals", "Tasks")
      await this.ensureSheetsExist();

      return true;
    } catch (error) {
      this.logger.error(`[GoogleSheets] Connection failed: ${error.message}`);
      return false;
    }
  }

  private async ensureSheetsExist(): Promise<void> {
    try {
      const response = await this.sheets.spreadsheets.get({
        spreadsheetId: this.spreadsheetId,
      });
      const existingSheets = response.data.sheets?.map(s => s.properties?.title) || [];
      
      const requiredSheets = [
        {
          title: 'Contactos',
          headers: ['ID', 'Nombre', 'Teléfono', 'Email', 'Plataforma', 'Fecha Registro'],
        },
        {
          title: 'Deals',
          headers: ['ID', 'Nombre Deal', 'Monto', 'ID Contacto', 'Etapa', 'Temperatura', 'Notas', 'Fecha Registro'],
        },
        {
          title: 'Tasks',
          headers: ['ID', 'Título', 'Fecha Límite', 'ID Contacto', 'Completado', 'Fecha Registro'],
        },
      ];

      const requests: any[] = [];

      for (const reqSheet of requiredSheets) {
        if (!existingSheets.includes(reqSheet.title)) {
          requests.push({
            addSheet: {
              properties: {
                title: reqSheet.title,
              },
            },
          });
        }
      }

      if (requests.length > 0) {
        await this.sheets.spreadsheets.batchUpdate({
          spreadsheetId: this.spreadsheetId,
          requestBody: { requests },
        });
        
        // Let's add headers for the newly created sheets
        for (const reqSheet of requiredSheets) {
          if (!existingSheets.includes(reqSheet.title)) {
            await this.sheets.spreadsheets.values.update({
              spreadsheetId: this.spreadsheetId,
              range: `${reqSheet.title}!A1`,
              valueInputOption: 'RAW',
              requestBody: {
                values: [reqSheet.headers],
              },
            });
          }
        }
        this.logger.log('[GoogleSheets] Required sheets created successfully');
      }
    } catch (err) {
      this.logger.error(`[GoogleSheets] Error ensuring sheets exist: ${err.message}`);
    }
  }

  async disconnect(): Promise<void> {
    this.spreadsheetId = null;
    this.apiKey = null;
    this.isConfigured = false;
    this.sheets = null;
  }

  async isConnected(): Promise<boolean> {
    return this.isConfigured;
  }

  /**
   * Inserta un nuevo contacto/lead como fila en Google Sheets en tiempo real.
   */
  async createContact(contact: ContactData): Promise<string> {
    if (!this.isConfigured) return contact.id || '';

    this.logger.log(`[GoogleSheets] Registrando fila de Contacto: ${contact.firstName || ''} ${contact.lastName || ''} (${contact.phone || ''})`);
    
    try {
      const rowValues = [
        contact.id || new Date().getTime().toString(),
        `${contact.firstName || ''} ${contact.lastName || ''}`.trim() || 'Sin Nombre',
        contact.phone || '',
        contact.email || '',
        contact.platformId || 'WHATSAPP',
        new Date().toISOString(),
      ];
      
      await this.sheets.spreadsheets.values.append({
        spreadsheetId: this.spreadsheetId,
        range: 'Contactos!A2',
        valueInputOption: 'RAW',
        requestBody: {
          values: [rowValues],
        },
      });
      
      return contact.id || rowValues[0];
    } catch (err) {
      this.logger.error(`[GoogleSheets] Error al insertar contacto en Sheets: ${err.message}`);
      return contact.id || '';
    }
  }

  async updateContact(contactId: string, data: ContactData): Promise<void> {
    if (!this.isConfigured) return;
    try {
      const response = await this.sheets.spreadsheets.values.get({
        spreadsheetId: this.spreadsheetId,
        range: 'Contactos!A:F',
      });
      const rows = response.data.values || [];
      const rowIndex = rows.findIndex(row => row[0] === contactId);
      if (rowIndex !== -1) {
        // rowIndex is 0-indexed, Google Sheets lines are 1-indexed
        const sheetRowNumber = rowIndex + 1;
        const currentContact = rows[rowIndex];
        
        const updatedName = `${data.firstName ?? ''} ${data.lastName ?? ''}`.trim() || currentContact[1];
        const updatedPhone = data.phone ?? currentContact[2];
        const updatedEmail = data.email ?? currentContact[3];
        const updatedPlatform = data.platformId ?? currentContact[4];
        
        await this.sheets.spreadsheets.values.update({
          spreadsheetId: this.spreadsheetId,
          range: `Contactos!B${sheetRowNumber}:E${sheetRowNumber}`,
          valueInputOption: 'RAW',
          requestBody: {
            values: [[updatedName, updatedPhone, updatedEmail, updatedPlatform]],
          },
        });
      }
    } catch (err) {
      this.logger.error(`[GoogleSheets] Error updating contact in Sheets: ${err.message}`);
    }
  }

  async getContact(contactId: string): Promise<ContactData> {
    return { id: contactId };
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
    this.logger.log(`[GoogleSheets] Agregando etiqueta '${label}' al contacto ${contactId} en Sheets.`);
  }

  async removeLabel(contactId: string, label: string): Promise<void> {
    this.logger.log(`[GoogleSheets] Removiendo etiqueta '${label}' del contacto ${contactId} en Sheets.`);
  }

  async getLabels(contactId: string): Promise<string[]> {
    return [];
  }

  async createLabel(label: string): Promise<string> {
    return label;
  }

  async createDeal(deal: DealData): Promise<string> {
    if (!this.isConfigured) return '';
    try {
      const dealId = new Date().getTime().toString();
      const rowValues = [
        dealId,
        deal.name,
        deal.amount || 0,
        deal.contactId,
        deal.stage || 'Nuevos Prospectos',
        deal.temperature || 'Frío',
        deal.notes || '',
        new Date().toISOString(),
      ];
      await this.sheets.spreadsheets.values.append({
        spreadsheetId: this.spreadsheetId,
        range: 'Deals!A2',
        valueInputOption: 'RAW',
        requestBody: {
          values: [rowValues],
        },
      });
      return dealId;
    } catch (err) {
      this.logger.error(`[GoogleSheets] Error creating deal in Sheets: ${err.message}`);
      return '';
    }
  }

  async createTask(task: TaskData): Promise<string> {
    if (!this.isConfigured) return '';
    try {
      const taskId = new Date().getTime().toString();
      const rowValues = [
        taskId,
        task.title,
        task.dueDate ? new Date(task.dueDate).toISOString() : '',
        task.contactId,
        'No',
        new Date().toISOString(),
      ];
      await this.sheets.spreadsheets.values.append({
        spreadsheetId: this.spreadsheetId,
        range: 'Tasks!A2',
        valueInputOption: 'RAW',
        requestBody: {
          values: [rowValues],
        },
      });
      return taskId;
    } catch (err) {
      this.logger.error(`[GoogleSheets] Error creating task in Sheets: ${err.message}`);
      return '';
    }
  }
}
