export interface WhatsAppWebhookPayload {
    object: string;
    entry: WhatsAppEntry[];
}
export interface WhatsAppEntry {
    id: string;
    changes: WhatsAppChange[];
}
export interface WhatsAppChange {
    value: {
        messaging_product: string;
        metadata: {
            display_phone_number: string;
            phone_number_id: string;
        };
        contacts?: WhatsAppContact[];
        messages?: WhatsAppMessage[];
        statuses?: WhatsAppStatus[];
    };
    field: string;
}
export interface WhatsAppContact {
    profile: {
        name: string;
    };
    wa_id: string;
}
export interface WhatsAppMessage {
    from: string;
    id: string;
    timestamp: string;
    text?: {
        body: string;
    };
    type: string;
    image?: {
        id: string;
        mime_type: string;
        sha256: string;
    };
}
export interface WhatsAppStatus {
    id: string;
    status: string;
    timestamp: string;
    recipient_id: string;
}
export interface AIPromptContext {
    businessId: string;
    businessName: string;
    industryType: string;
    customerMessage: string;
    conversationHistory?: string[];
    knowledgeContext: string[];
    customPrompt?: string;
}
export interface MediaToSend {
    type: 'image' | 'video' | 'document' | 'audio';
    fileId?: string;
    filePath?: string;
    filename?: string;
    mimetype?: string;
    caption?: string;
}
export interface AIResponse {
    message: string;
    confidence: number;
    shouldEscalate: boolean;
    suggestedActions?: string[];
    processingTime: number;
    mediaToSend?: MediaToSend[];
}
export interface VectorSearchResult {
    id: string;
    content: string;
    score: number;
    metadata?: Record<string, any>;
}
export interface FileProcessingResult {
    success: boolean;
    fileId: string;
    chunksCreated: number;
    error?: string;
}
export interface DashboardMetrics {
    totalMessages: number;
    messagesHandledByAI: number;
    averageResponseTime: number;
    customerSatisfaction?: number;
    activeConversations: number;
    appointmentsToday: number;
    ordersToday: number;
    leadsGenerated: number;
}
//# sourceMappingURL=index.d.ts.map