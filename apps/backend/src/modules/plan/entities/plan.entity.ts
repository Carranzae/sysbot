export enum PlanType {
  FREE = 'FREE',
  STARTER = 'STARTER',
  PROFESSIONAL = 'PROFESSIONAL',
  BUSINESS = 'BUSINESS',
  ENTERPRISE = 'ENTERPRISE',
}

export enum PlanInterval {
  MONTHLY = 'MONTHLY',
  YEARLY = 'YEARLY',
}

export interface PlanFeatures {
  maxUsers: number;
  maxBranches: number;
  maxProducts?: number;
  maxServices?: number;
  maxProperties?: number;
  maxCourses?: number;
  maxStudents?: number;
  maxAppointmentsPerMonth?: number;
  maxConversations?: number;
  hasReservations: boolean;
  hasDelivery: boolean;
  hasTableManagement: boolean;
  hasLoyaltyProgram: boolean;
  hasMarketingAutomation: boolean;
  hasAdvancedAnalytics: boolean;
  hasAI: boolean;
  hasTelemedicine: boolean;
  hasPharmacy: boolean;
  hasLaboratory: boolean;
  hasCRM: boolean;
  hasVirtualTours: boolean;
  hasLMS: boolean;
  hasCertificates: boolean;
  hasInventory: boolean;
  hasProjectManagement: boolean;
  hasWhiteLabel: boolean;
  hasDedicatedSupport: boolean;
  // --- New Industrial Features ---
  hasAudioResponses: boolean;
  hasVoiceTranscription: boolean;
  hasCallHandling: boolean;
  hasAdvancedWebhooks: boolean;
  hasCustomApiKeys: boolean;
  hasReminders: boolean;
  integrations: string[];
}

export interface PlanConfig {
  id: string;
  name: string;
  type: PlanType;
  priceMonthly: number;
  priceYearly: number;
  description: string;
  features: PlanFeatures;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export const DEFAULT_PLANS: PlanConfig[] = [
  {
    id: 'plan-free',
    name: 'Free',
    type: PlanType.FREE,
    priceMonthly: 0,
    priceYearly: 0,
    description: 'Prueba gratuita del sistema',
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    features: {
      maxUsers: 1,
      maxBranches: 1,
      maxProducts: 10,
      maxServices: 3,
      maxProperties: 2,
      maxCourses: 1,
      maxStudents: 10,
      maxAppointmentsPerMonth: 20,
      maxConversations: 100,
      hasReservations: false,
      hasDelivery: false,
      hasTableManagement: false,
      hasLoyaltyProgram: false,
      hasMarketingAutomation: false,
      hasAdvancedAnalytics: false,
      hasAI: false,
      hasTelemedicine: false,
      hasPharmacy: false,
      hasLaboratory: false,
      hasCRM: false,
      hasVirtualTours: false,
      hasLMS: false,
      hasCertificates: false,
      hasInventory: false,
      hasProjectManagement: false,
      hasWhiteLabel: false,
      hasDedicatedSupport: false,
      hasAudioResponses: false,
      hasVoiceTranscription: false,
      hasCallHandling: false,
      hasAdvancedWebhooks: false,
      hasCustomApiKeys: false,
      hasReminders: false,
      integrations: [],
    },
  },
  {
    id: 'plan-starter',
    name: 'Starter',
    type: PlanType.STARTER,
    priceMonthly: 19,
    priceYearly: 190,
    description: 'Para emprendedores y negocios pequeños',
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    features: {
      maxUsers: 2,
      maxBranches: 1,
      maxProducts: 50,
      maxServices: 5,
      maxProperties: 10,
      maxCourses: 3,
      maxStudents: 50,
      maxAppointmentsPerMonth: 50,
      maxConversations: -1, // ilimitado
      hasReservations: true,
      hasDelivery: true,
      hasTableManagement: false,
      hasLoyaltyProgram: false,
      hasMarketingAutomation: false,
      hasAdvancedAnalytics: false,
      hasAI: false,
      hasTelemedicine: false,
      hasPharmacy: false,
      hasLaboratory: false,
      hasCRM: false,
      hasVirtualTours: false,
      hasLMS: false,
      hasCertificates: false,
      hasInventory: false,
      hasProjectManagement: false,
      hasWhiteLabel: false,
      hasDedicatedSupport: false,
      hasAudioResponses: false,
      hasVoiceTranscription: false,
      hasCallHandling: false,
      hasAdvancedWebhooks: false,
      hasCustomApiKeys: false,
      hasReminders: true,
      integrations: [],
    },
  },
  {
    id: 'plan-professional',
    name: 'Professional',
    type: PlanType.PROFESSIONAL,
    priceMonthly: 49,
    priceYearly: 490,
    description: 'Para negocios establecidos en crecimiento',
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    features: {
      maxUsers: 5,
      maxBranches: 1,
      maxProducts: -1, // ilimitado
      maxServices: -1,
      maxProperties: -1,
      maxCourses: -1,
      maxStudents: 200,
      maxAppointmentsPerMonth: -1,
      maxConversations: -1,
      hasReservations: true,
      hasDelivery: true,
      hasTableManagement: true,
      hasLoyaltyProgram: true,
      hasMarketingAutomation: true,
      hasAdvancedAnalytics: true,
      hasAI: false,
      hasTelemedicine: true,
      hasPharmacy: true,
      hasLaboratory: true,
      hasCRM: true,
      hasVirtualTours: false,
      hasLMS: true,
      hasCertificates: true,
      hasInventory: true,
      hasProjectManagement: true,
      hasWhiteLabel: false,
      hasDedicatedSupport: false,
      hasAudioResponses: false,
      hasVoiceTranscription: true, // STT from Professional
      hasCallHandling: false,
      hasAdvancedWebhooks: false,
      hasCustomApiKeys: false,
      hasReminders: true,
      integrations: ['whatsapp-api', 'basic-webhooks'],
    },
  },
  {
    id: 'plan-business',
    name: 'Business',
    type: PlanType.BUSINESS,
    priceMonthly: 79,
    priceYearly: 790,
    description: 'Para negocios grandes y múltiples operaciones',
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    features: {
      maxUsers: 15,
      maxBranches: 3,
      maxProducts: -1,
      maxServices: -1,
      maxProperties: -1,
      maxCourses: -1,
      maxStudents: 500,
      maxAppointmentsPerMonth: -1,
      maxConversations: -1,
      hasReservations: true,
      hasDelivery: true,
      hasTableManagement: true,
      hasLoyaltyProgram: true,
      hasMarketingAutomation: true,
      hasAdvancedAnalytics: true,
      hasAI: true,
      hasTelemedicine: true,
      hasPharmacy: true,
      hasLaboratory: true,
      hasCRM: true,
      hasVirtualTours: true,
      hasLMS: true,
      hasCertificates: true,
      hasInventory: true,
      hasProjectManagement: true,
      hasWhiteLabel: false,
      hasDedicatedSupport: true,
      hasAudioResponses: true, // TTS from Business
      hasVoiceTranscription: true,
      hasCallHandling: true,
      hasAdvancedWebhooks: true,
      hasCustomApiKeys: true,
      hasReminders: true,
      integrations: ['whatsapp-api', 'webhooks', 'stripe', 'rappi', 'uber-eats'],
    },
  },
  {
    id: 'plan-enterprise',
    name: 'Enterprise',
    type: PlanType.ENTERPRISE,
    priceMonthly: 149,
    priceYearly: 1490,
    description: 'Para corporaciones y cadenas nacionales',
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    features: {
      maxUsers: -1, // ilimitado
      maxBranches: -1,
      maxProducts: -1,
      maxServices: -1,
      maxProperties: -1,
      maxCourses: -1,
      maxStudents: -1,
      maxAppointmentsPerMonth: -1,
      maxConversations: -1,
      hasReservations: true,
      hasDelivery: true,
      hasTableManagement: true,
      hasLoyaltyProgram: true,
      hasMarketingAutomation: true,
      hasAdvancedAnalytics: true,
      hasAI: true,
      hasTelemedicine: true,
      hasPharmacy: true,
      hasLaboratory: true,
      hasCRM: true,
      hasVirtualTours: true,
      hasLMS: true,
      hasCertificates: true,
      hasInventory: true,
      hasProjectManagement: true,
      hasWhiteLabel: true,
      hasDedicatedSupport: true,
      hasAudioResponses: true,
      hasVoiceTranscription: true,
      hasCallHandling: true,
      hasAdvancedWebhooks: true,
      hasCustomApiKeys: true,
      hasReminders: true,
      integrations: ['whatsapp-api', 'webhooks', 'stripe', 'rappi', 'uber-eats', 'sap', 'salesforce', 'hubspot'],
    },
  },
];

export interface BusinessSubscription {
  id: string;
  businessId: string;
  planId: string;
  planType: PlanType;
  interval: PlanInterval;
  status: 'ACTIVE' | 'CANCELLED' | 'EXPIRED' | 'PENDING';
  startDate: Date;
  endDate: Date;
  trialEndsAt?: Date;
  cancelAtPeriodEnd: boolean;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  createdAt: Date;
  updatedAt: Date;
}

export function getPlanByType(type: PlanType): PlanConfig | undefined {
  return DEFAULT_PLANS.find(plan => plan.type === type);
}

export function getPlanById(id: string): PlanConfig | undefined {
  return DEFAULT_PLANS.find(plan => plan.id === id);
}

export function getAllPlans(): PlanConfig[] {
  return DEFAULT_PLANS.filter(plan => plan.isActive);
}

export function calculatePlanPrice(
  planType: PlanType,
  interval: PlanInterval,
  industryType?: string,
): number {
  const plan = getPlanByType(planType);
  if (!plan) return 0;

  let basePrice = interval === PlanInterval.YEARLY ? plan.priceYearly : plan.priceMonthly;

  // Ajustes por industria
  const industryMultipliers: Record<string, number> = {
    'RESTAURANT': 1,
    'CLINIC': 1.3,        // Clínicas son más caras
    'REAL_ESTATE': 1.2,
    'ACADEMY': 1,
    'RETAIL': 0.8,        // Retail es más barato
    'SERVICES': 0.8,
    'OTHER': 0.8,
  };

  if (industryType && industryMultipliers[industryType]) {
    basePrice = Math.round(basePrice * industryMultipliers[industryType]);
  }

  return basePrice;
}

export function checkPlanLimit(
  currentValue: number,
  limit: number,
): { allowed: boolean; remaining: number } {
  if (limit === -1) {
    return { allowed: true, remaining: -1 }; // ilimitado
  }
  
  const remaining = limit - currentValue;
  return {
    allowed: remaining > 0,
    remaining: Math.max(0, remaining),
  };
}

export function getFeatureValue(
  planType: PlanType,
  feature: keyof PlanFeatures,
): any {
  const plan = getPlanByType(planType);
  if (!plan) return false;
  return plan.features[feature];
}

export function hasFeature(planType: PlanType, feature: keyof PlanFeatures): boolean {
  const value = getFeatureValue(planType, feature);
  return value === true || (typeof value === 'number' && value !== 0);
}
