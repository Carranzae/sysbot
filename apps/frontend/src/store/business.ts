import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { businessApi } from '@/lib/api'

interface BotConfig {
  ragChannelTargets?: string[]
}

interface Business {
  id: string
  name: string
  industryType: string
  categories: string[]
  description?: string
  phone?: string
  email?: string
  address?: string
  allowedFeatures?: string[]
  planExpiresAt?: string | null
  isActive?: boolean
  allowedSocials?: string[]
  botConfig?: BotConfig | null
}

interface BusinessState {
  businesses: Business[]
  selectedBusiness: Business | null
  setBusinesses: (businesses: Business[]) => void
  setSelectedBusiness: (business: Business | null) => void
  clearBusinesses: () => void
  loadBusinesses: () => Promise<void>
}

export const useBusinessStore = create<BusinessState>()(
  persist(
    (set, get) => ({
      businesses: [],
      selectedBusiness: null,
      setBusinesses: (businesses) => set({ businesses }),
      setSelectedBusiness: (business) => set({ selectedBusiness: business }),
      clearBusinesses: () => set({ businesses: [], selectedBusiness: null }),
      loadBusinesses: async () => {
        try {
          console.log('🔍 Cargando negocios desde API...');
          const response = await businessApi.getAll()
          const businesses = response.data
          console.log('✅ Negocios cargados:', businesses.length, businesses.map((b: any) => b.name));
          set({ businesses })
          
          // Si no hay negocio seleccionado pero hay negocios disponibles, seleccionar el primero
          const { selectedBusiness } = get()
          if (!selectedBusiness && businesses.length > 0) {
            console.log('🎯 Seleccionando primer negocio:', businesses[0].name);
            set({ selectedBusiness: businesses[0] })
          }
        } catch (error) {
          console.error('❌ Error loading businesses:', error)
        }
      }
    }),
    {
      name: 'business-storage',
    }
  )
)
