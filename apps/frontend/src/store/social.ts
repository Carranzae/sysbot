import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { businessApi } from '@/lib/api';

export type PlatformKey = 'tiktok' | 'instagram' | 'youtube' | 'facebook' | 'linkedin';
export type ChannelMode = 'AUTO' | 'ASISTIDO' | 'MANUAL';
export type ChannelStatus = 'connected' | 'disconnected' | 'needs_action';

export interface SocialChannel {
  key: PlatformKey;
  title: string;
  mode: ChannelMode;
  status: ChannelStatus;
  accountLabel?: string;
  connectedAt?: string;
}

export interface SocialSettings {
  timezone: string;
  allowedStart: string;
  allowedEnd: string;
  frequency: '3_week' | '1_day' | '2_day' | 'custom';
  minSpacingMinutes: number;
  stagger: boolean;
  notifications: {
    email: boolean;
    whatsapp: boolean;
    push: boolean;
  };
}

interface SocialState {
  // Map of businessId to its social data
  businessData: Record<string, {
    channels: SocialChannel[];
    settings: SocialSettings;
  }>;
  isLoading: boolean;
  error: string | null;
  
  // Actions
  fetchBusinessData: (businessId: string) => Promise<void>;
  updateChannels: (businessId: string, channels: SocialChannel[]) => void;
  setChannels: (businessId: string, channels: SocialChannel[]) => Promise<void>;
  updateSettings: (businessId: string, settings: Partial<SocialSettings>) => Promise<void>;
  connectChannel: (businessId: string, platform: PlatformKey, accountLabel: string) => Promise<void>;
  disconnectChannel: (businessId: string, platform: PlatformKey) => Promise<void>;
}

const defaultSettings: SocialSettings = {
  timezone: 'America/Bogota',
  allowedStart: '08:00',
  allowedEnd: '22:00',
  frequency: '3_week',
  minSpacingMinutes: 20,
  stagger: true,
  notifications: {
    email: true,
    whatsapp: true,
    push: true,
  },
};

const defaultChannels: SocialChannel[] = [
  { key: 'tiktok', title: 'TikTok', mode: 'ASISTIDO', status: 'disconnected' },
  { key: 'instagram', title: 'Instagram', mode: 'ASISTIDO', status: 'disconnected' },
  { key: 'youtube', title: 'YouTube', mode: 'AUTO', status: 'disconnected' },
  { key: 'facebook', title: 'Facebook', mode: 'AUTO', status: 'disconnected' },
  { key: 'linkedin', title: 'LinkedIn', mode: 'AUTO', status: 'disconnected' },
];

export const useSocialStore = create<SocialState>()(
  persist(
    (set, get) => ({
      businessData: {},
      isLoading: false,
      error: null,

      fetchBusinessData: async (businessId) => {
        set({ isLoading: true, error: null });
        try {
          // Obtener configuración de redes sociales
          const response = await businessApi.getSocialSettings(businessId);
          const data = response.data;
          
          // Obtener el negocio completo para sacar los canales conectados
          const businessRes = await businessApi.getOne(businessId);
          const business = businessRes.data;
          
          // RESET TOTAL: Empezamos con canales limpios para la vida real
          let businessChannels = defaultChannels.map(c => ({ 
            ...c, 
            status: 'disconnected' as ChannelStatus, 
            accountLabel: undefined 
          }));

          // Solo procesar si el backend tiene datos REALES que no sean de prueba
          if (business.allowedSocials && business.allowedSocials.length > 0) {
            try {
              const savedChannels = business.allowedSocials.map((s: string) => JSON.parse(s));
              
              businessChannels = businessChannels.map(def => {
                const saved = savedChannels.find((s: any) => s.key === def.key);
                
                // CRITERIO ESTRICTO DE VIDA REAL:
                // Solo restaurar si tiene una etiqueta de cuenta que NO sea genérica ni de prueba
                const isRealAccount = saved?.accountLabel && 
                                    !saved.accountLabel.includes('cuenta_') && 
                                    !saved.accountLabel.includes('validada') &&
                                    !saved.accountLabel.includes('@app_') &&
                                    saved.accountLabel !== '@user';

                if (saved && isRealAccount && (saved.status === 'connected' || saved.status === 'needs_action')) {
                  return saved;
                }
                
                // Si no es real o es un rastro de prueba, forzar desconexión
                return { ...def, status: 'disconnected' as ChannelStatus, accountLabel: undefined };
              });
            } catch (e) {
              console.error('Error parsing social channels:', e);
            }
          }

          // Actualizar el estado global con datos filtrados
          set((state) => ({
            businessData: {
              ...state.businessData,
              [businessId]: { 
                channels: businessChannels, 
                settings: {
                  timezone: data.socialTimezone || defaultSettings.timezone,
                  allowedStart: data.socialAllowedStart || defaultSettings.allowedStart,
                  allowedEnd: data.socialAllowedEnd || defaultSettings.allowedEnd,
                  frequency: (data.socialFrequency as any) || defaultSettings.frequency,
                  minSpacingMinutes: data.socialMinSpacing ?? defaultSettings.minSpacingMinutes,
                  stagger: data.socialStagger ?? defaultSettings.stagger,
                  notifications: {
                    email: data.socialNotifyEmail ?? defaultSettings.notifications.email,
                    whatsapp: data.socialNotifyWhatsapp ?? defaultSettings.notifications.whatsapp,
                    push: data.socialNotifyPush ?? defaultSettings.notifications.push,
                  },
                }
              },
            },
            isLoading: false,
          }));
        } catch (err: any) {
          set({ error: err.message, isLoading: false });
          // Inicialización limpia en caso de error
          set((state) => ({
            businessData: {
              ...state.businessData,
              [businessId]: { channels: defaultChannels.map(c => ({...c, status: 'disconnected' as ChannelStatus})), settings: defaultSettings },
            },
          }));
        }
      },

      updateChannels: (businessId, channels) =>
        set((state) => ({
          businessData: {
            ...state.businessData,
            [businessId]: { ...state.businessData[businessId], channels },
          },
        })),

      setChannels: async (businessId, channels) => {
        const currentData = get().businessData[businessId] || { channels: defaultChannels, settings: defaultSettings };

        set((state) => ({
          businessData: {
            ...state.businessData,
            [businessId]: { ...currentData, channels },
          },
        }));

        try {
          await businessApi.updateSocialChannels(businessId, { channels });
        } catch (err: any) {
          set({ error: err.message });
        }
      },

      updateSettings: async (businessId, newSettings) => {
        const currentData = get().businessData[businessId];
        if (!currentData) return;

        const updatedSettings = { ...currentData.settings, ...newSettings };
        
        // Optimistic update
        set((state) => ({
          businessData: {
            ...state.businessData,
            [businessId]: { ...currentData, settings: updatedSettings },
          },
        }));

        try {
          // Sync with backend
          await businessApi.updateSocialSettings(businessId, {
            socialFrequency: updatedSettings.frequency,
            socialTimezone: updatedSettings.timezone,
            socialAllowedStart: updatedSettings.allowedStart,
            socialAllowedEnd: updatedSettings.allowedEnd,
            socialMinSpacing: updatedSettings.minSpacingMinutes,
            socialStagger: updatedSettings.stagger,
            socialNotifyEmail: updatedSettings.notifications.email,
            socialNotifyWhatsapp: updatedSettings.notifications.whatsapp,
            socialNotifyPush: updatedSettings.notifications.push,
          });
        } catch (err: any) {
          set({ error: err.message });
          // Rollback could be implemented here
        }
      },

      connectChannel: async (businessId, platform, accountLabel) => {
        const currentData = get().businessData[businessId] || { channels: defaultChannels, settings: defaultSettings };
        
        // SOLO CONECTAR SI EL LABEL NO ES GENÉRICO (Lógica de Vida Real)
        if (accountLabel.includes('cuenta_')) {
          console.warn('Simulación bloqueada: Use validación técnica real.');
          return;
        }

        const updatedChannels: SocialChannel[] = currentData.channels.map((c) =>
          c.key === platform
            ? {
                ...c,
                status: (c.mode === 'AUTO' ? 'connected' : 'needs_action') as ChannelStatus,
                accountLabel,
                connectedAt: new Date().toISOString(),
              }
            : c
        );

        await get().setChannels(businessId, updatedChannels);
      },

      disconnectChannel: async (businessId, platform) => {
        const currentData = get().businessData[businessId];
        if (!currentData) return;

        const updatedChannels: SocialChannel[] = currentData.channels.map((c) =>
          c.key === platform ? { ...c, status: 'disconnected' as ChannelStatus, accountLabel: undefined, connectedAt: undefined } : c
        );

        await get().setChannels(businessId, updatedChannels);
      },
    }),
    {
      name: 'social-storage',
    }
  )
);
