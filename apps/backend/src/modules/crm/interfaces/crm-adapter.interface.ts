export interface CRMConfig {
  accessToken?: string;
  refreshToken?: string;
  apiKey?: string;
  apiSecret?: string;
  baseUrl?: string;
  config?: any;
}

export interface ContactData {
  id?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  platformId?: string;
}

export interface ConversationData {
  id: string;
  participants: string[];
  messages: MessageData[];
  createdAt: Date;
}

export interface MessageData {
  id: string;
  message: string;
  from: string;
  createdAt: Date;
}

export interface DealData {
  name: string;
  amount: number;
  contactId: string;
  stage: string;
}

export interface TaskData {
  title: string;
  dueDate: Date;
  contactId: string;
}

export interface ConversationFilters {
  startDate?: Date;
  endDate?: Date;
  limit?: number;
}

export interface SyncFilters {
  startDate?: Date;
  endDate?: Date;
}

export interface SyncResult {
  success: boolean;
  count: number;
  errors?: string[];
}

export interface CRMAdapter {
  connect(config: CRMConfig): Promise<boolean>;
  disconnect(): Promise<void>;
  isConnected(): Promise<boolean>;
  
  createContact(contact: ContactData): Promise<string>;
  updateContact(contactId: string, data: ContactData): Promise<void>;
  getContact(contactId: string): Promise<ContactData>;
  searchContacts(query: string): Promise<ContactData[]>;
  
  createConversation(conversation: ConversationData): Promise<string>;
  sendMessage(conversationId: string, message: MessageData): Promise<string>;
  getConversations(filters?: ConversationFilters): Promise<ConversationData[]>;
  
  addLabel(contactId: string, label: string): Promise<void>;
  removeLabel(contactId: string, label: string): Promise<void>;
  getLabels(contactId: string): Promise<string[]>;
  createLabel(label: string): Promise<string>;
  
  createDeal?(deal: DealData): Promise<string>;
  updateDeal?(dealId: string, data: DealData): Promise<void>;
  
  createTask?(task: TaskData): Promise<string>;
  createNote?(contactId: string, note: string): Promise<string>;
  
  syncContacts?(filters?: SyncFilters): Promise<SyncResult>;
  syncConversations?(filters?: SyncFilters): Promise<SyncResult>;
}










