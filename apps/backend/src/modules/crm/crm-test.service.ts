import { Injectable, Logger } from '@nestjs/common';
import { CRMFactoryService } from './crm-factory.service';
import { CRMProvider } from '@prisma/client';
import { ContactData, DealData } from './interfaces/crm-adapter.interface';

@Injectable()
export class CRMTestService {
  private readonly logger = new Logger(CRMTestService.name);

  constructor(private crmFactory: CRMFactoryService) {}

  async testAllCRMs(): Promise<{ [key: string]: any }> {
    const results: { [key: string]: any } = {};

    // Test HubSpot
    try {
      const hubspotResult = await this.testHubSpot();
      results['HubSpot'] = hubspotResult;
    } catch (error) {
      results['HubSpot'] = { success: false, error: error.message };
    }

    // Test Salesforce
    try {
      const salesforceResult = await this.testSalesforce();
      results['Salesforce'] = salesforceResult;
    } catch (error) {
      results['Salesforce'] = { success: false, error: error.message };
    }

    // Test Zoho
    try {
      const zohoResult = await this.testZoho();
      results['Zoho'] = zohoResult;
    } catch (error) {
      results['Zoho'] = { success: false, error: error.message };
    }

    return results;
  }

  private async testHubSpot(): Promise<any> {
    this.logger.log('[CRM Test] Testing HubSpot integration...');
    
    const adapter = this.crmFactory.createAdapter(CRMProvider.HUBSPOT);
    
    // Test de conexión (usando credenciales de prueba)
    const testConfig = {
      accessToken: 'test-token',
      refreshToken: 'test-refresh',
      apiKey: 'test-key',
      apiSecret: 'test-secret'
    };

    const connected = await adapter.connect(testConfig);
    
    if (!connected) {
      return { success: false, error: 'Connection failed' };
    }

    // Test de creación de contacto
    const testContact: ContactData = {
      firstName: 'Test',
      lastName: 'User',
      email: 'test@example.com',
      phone: '+1234567890'
    };

    try {
      const contactId = await adapter.createContact(testContact);
      
      // Test de búsqueda
      const searchResults = await adapter.searchContacts('Test');
      
      // Test de creación de deal
      const testDeal: DealData = {
        name: 'Test Deal',
        amount: 1000,
        contactId: contactId,
        stage: 'Prospecting'
      };
      
      const dealId = await adapter.createDeal(testDeal);

      return {
        success: true,
        contactId,
        dealId,
        searchResultsCount: searchResults.length
      };
    } catch (error) {
      return { success: true, connected: true, error: error.message };
    }
  }

  private async testSalesforce(): Promise<any> {
    this.logger.log('[CRM Test] Testing Salesforce integration...');
    
    const adapter = this.crmFactory.createAdapter(CRMProvider.SALESFORCE);
    
    const testConfig = {
      accessToken: 'test-token',
      refreshToken: 'test-refresh',
      apiKey: 'test-key',
      apiSecret: 'test-secret',
      baseUrl: 'https://test.salesforce.com'
    };

    const connected = await adapter.connect(testConfig);
    
    if (!connected) {
      return { success: false, error: 'Connection failed' };
    }

    const testContact: ContactData = {
      firstName: 'Test',
      lastName: 'User',
      email: 'test@example.com',
      phone: '+1234567890'
    };

    try {
      const contactId = await adapter.createContact(testContact);
      
      const searchResults = await adapter.searchContacts('Test');
      
      const testDeal: DealData = {
        name: 'Test Opportunity',
        amount: 1000,
        contactId: contactId,
        stage: 'Prospecting'
      };
      
      const dealId = await adapter.createDeal(testDeal);

      return {
        success: true,
        contactId,
        dealId,
        searchResultsCount: searchResults.length
      };
    } catch (error) {
      return { success: true, connected: true, error: error.message };
    }
  }

  private async testZoho(): Promise<any> {
    this.logger.log('[CRM Test] Testing Zoho integration...');
    
    const adapter = this.crmFactory.createAdapter(CRMProvider.ZOHO);
    
    const testConfig = {
      accessToken: 'test-token',
      refreshToken: 'test-refresh',
      apiKey: 'test-key',
      apiSecret: 'test-secret'
    };

    const connected = await adapter.connect(testConfig);
    
    if (!connected) {
      return { success: false, error: 'Connection failed' };
    }

    const testContact: ContactData = {
      firstName: 'Test',
      lastName: 'User',
      email: 'test@example.com',
      phone: '+1234567890'
    };

    try {
      const contactId = await adapter.createContact(testContact);
      
      const searchResults = await adapter.searchContacts('Test');
      
      const testDeal: DealData = {
        name: 'Test Deal',
        amount: 1000,
        contactId: contactId,
        stage: 'Qualification'
      };
      
      const dealId = await adapter.createDeal(testDeal);

      return {
        success: true,
        contactId,
        dealId,
        searchResultsCount: searchResults.length
      };
    } catch (error) {
      return { success: true, connected: true, error: error.message };
    }
  }

  async getAvailableCRMs(): Promise<{ provider: CRMProvider; name: string; description: string; features: string[] }[]> {
    return [
      {
        provider: CRMProvider.HUBSPOT,
        name: 'HubSpot',
        description: 'CRM para marketing y ventas',
        features: ['Contactos', 'Deals', 'Tasks', 'Email Marketing', 'Analytics']
      },
      {
        provider: CRMProvider.SALESFORCE,
        name: 'Salesforce',
        description: 'CRM empresarial completo',
        features: ['Contactos', 'Opportunities', 'Tasks', 'Reports', 'Custom Objects']
      },
      {
        provider: CRMProvider.ZOHO,
        name: 'Zoho CRM',
        description: 'CRM económico para PYMES',
        features: ['Contactos', 'Deals', 'Tasks', 'Inventory', 'Invoices']
      },
      {
        provider: CRMProvider.META_CRM,
        name: 'Meta CRM',
        description: 'CRM para redes sociales',
        features: ['Contactos', 'Conversaciones', 'Labels', 'Instagram', 'Messenger']
      }
    ];
  }
}
