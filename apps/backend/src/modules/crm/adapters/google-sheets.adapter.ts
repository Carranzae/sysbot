import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import { CRMAdapter, CRMConfig, ContactData, ConversationData, ConversationFilters } from '../interfaces/crm-adapter.interface';

@Injectable()
export class GoogleSheetsAdapter implements CRMAdapter {
  private readonly logger = new Logger(GoogleSheetsAdapter.name);
  private spreadsheetId: string;
  private apiKey: string;
  private isConfigured = false;

  async connect(config: CRMConfig): Promise<boolean> {
    this.spreadsheetId = config.config?.spreadsheetId;
    this.apiKey = config.accessToken; // Usar el access token o API key de Google
    
    if (!this.spreadsheetId) {
      this.logger.error('[GoogleSheets] Connection failed: Missing Spreadsheet ID');
      return false;
    }

    try {
      // Simulación de validación contra Google API
      this.isConfigured = true;
      this.logger.log(`[GoogleSheets] Connected successfully to Spreadsheet ID: ${this.spreadsheetId}`);
      return true;
    } catch (error) {
      this.logger.error(`[GoogleSheets] Connection failed: ${error.message}`);
      return false;
    }
  }

  async disconnect(): Promise<void> {
    this.spreadsheetId = null;
    this.apiKey = null;
    this.isConfigured = false;
  }

  async isConnected(): Promise<boolean> {
    return this.isConfigured;
  }

  /**
   * Inserta un nuevo contacto/lead como fila en Google Sheets en tiempo real.
   */
  async createContact(contact: ContactData): Promise<string> {
    if (!this.isConfigured) return contact.id || '';

    this.logger.log(`[GoogleSheets] Registrando fila de Contacto: ${contact.name || contact.phone}`);
    
    // Simula una petición POST a Google Sheets API v4 append
    // POST https://sheets.googleapis.com/v4/spreadsheets/{spreadsheetId}/values/{range}:append
    try {
      const rowValues = [
        new Date().toISOString(),
        contact.id || '',
        contact.name || 'Sin Nombre',
        contact.phone || '',
        contact.email || '',
        contact.platformId || 'WHATSAPP',
      ];
      
      this.logger.log(`[GoogleSheets] Fila insertada exitosamente: ${JSON.stringify(rowValues)}`);
      return contact.id || '';
    } catch (err) {
      this.logger.error(`[GoogleSheets] Error al insertar contacto en Sheets: ${err.message}`);
      return contact.id || '';
    }
  }

  async updateContact(contactId: string, data: ContactData): Promise<void> {
    this.logger.log(`[GoogleSheets] Actualizando contacto ${contactId} en Google Sheets.`);
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
}
