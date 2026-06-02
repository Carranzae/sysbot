'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { RecommendationChannel } from '@/lib/recommendations'

export type RecommendationStatus = 'Borrador' | 'Programado' | 'Enviado'

export interface RecommendationContact {
  id: string
  name: string
  tags: string[]
  lastInteraction: string
  channel: RecommendationChannel
}

export interface RecommendationCampaign {
  id: string
  name: string
  channel: RecommendationChannel
  status: RecommendationStatus
  scheduledAt?: string | null
  reachLabel: string
  createdAt: string
  message?: string
}

interface RecommendationsState {
  contacts: RecommendationContact[]
  campaigns: RecommendationCampaign[]
  filter: string
  selectedContacts: string[]
  setFilter: (filter: string) => void
  toggleContact: (id: string) => void
  setSelectedContacts: (ids: string[]) => void
  selectAllContacts: () => void
  clearSelectedContacts: () => void
  createCampaign: (payload: {
    name: string
    channel: RecommendationChannel
    scheduledAt?: string
    reachLabel: string
    message?: string
  }) => RecommendationCampaign
  duplicateCampaign: (id: string) => RecommendationCampaign | null
  resendCampaign: (id: string) => RecommendationCampaign | null
  exportSelectedContacts: () => RecommendationContact[]
}

const initialContacts: RecommendationContact[] = [
  { id: 'c1', name: 'Ana Pérez', tags: ['Preguntó', 'WhatsApp'], lastInteraction: 'hace 2h', channel: 'whatsapp' },
  { id: 'c2', name: 'Carlos Díaz', tags: ['Cliente', 'Email'], lastInteraction: 'ayer', channel: 'email' },
  { id: 'c3', name: 'Lucía Rojas', tags: ['Lead', 'Push'], lastInteraction: 'hace 3 días', channel: 'push' },
  { id: 'c4', name: 'Javier Torres', tags: ['Cliente', 'SMS'], lastInteraction: 'hace 5 días', channel: 'sms' },
]

const initialCampaigns: RecommendationCampaign[] = [
  {
    id: 'h1',
    name: 'Campaña relanzamiento',
    status: 'Enviado',
    channel: 'whatsapp',
    scheduledAt: '2025-12-24T09:30:00-05:00',
    reachLabel: '482 contactos',
    createdAt: '2025-12-24T09:30:00-05:00',
  },
  {
    id: 'h2',
    name: 'Seguimiento consultas',
    status: 'Programado',
    channel: 'email',
    scheduledAt: '2025-12-26T10:00:00-05:00',
    reachLabel: '210 contactos',
    createdAt: '2025-12-20T10:00:00-05:00',
  },
  {
    id: 'h3',
    name: 'Promo VIP',
    status: 'Borrador',
    channel: 'sms',
    reachLabel: 'Selecciona contactos',
    createdAt: '2025-12-18T08:00:00-05:00',
  },
]

export const contactFilters = [
  { id: 'all', label: 'Todos' },
  { id: 'asked', label: 'Solo preguntaron' },
  { id: 'clients', label: 'Clientes activos' },
  { id: 'leads', label: 'Leads nuevos' },
]

export const useRecommendationsStore = create<RecommendationsState>()(
  persist(
    (set, get) => ({
      contacts: initialContacts,
      campaigns: initialCampaigns,
      filter: 'all',
      selectedContacts: [],
      setFilter: (filter) => set({ filter }),
      toggleContact: (id) =>
        set((state) => ({
          selectedContacts: state.selectedContacts.includes(id)
            ? state.selectedContacts.filter((contactId) => contactId !== id)
            : [...state.selectedContacts, id],
        })),
      setSelectedContacts: (ids) => set({ selectedContacts: Array.from(new Set(ids)) }),
      selectAllContacts: () =>
        set((state) => ({
          selectedContacts: state.contacts.map((contact) => contact.id),
        })),
      clearSelectedContacts: () => set({ selectedContacts: [] }),
      createCampaign: ({ name, channel, scheduledAt, reachLabel, message }) => {
        const isScheduled = Boolean(scheduledAt)
        const newCampaign: RecommendationCampaign = {
          id: `cmp_${Date.now()}`,
          name: name || 'Recomendación sin título',
          channel,
          status: isScheduled ? 'Programado' : 'Enviado',
          scheduledAt: scheduledAt || new Date().toISOString(),
          reachLabel,
          createdAt: new Date().toISOString(),
          message,
        }
        set((state) => ({
          campaigns: [newCampaign, ...state.campaigns],
        }))
        return newCampaign
      },
      duplicateCampaign: (id) => {
        const campaign = get().campaigns.find((item) => item.id === id)
        if (!campaign) return null
        const duplicated: RecommendationCampaign = {
          ...campaign,
          id: `cmp_${Date.now()}`,
          status: 'Borrador',
          scheduledAt: null,
          createdAt: new Date().toISOString(),
          name: `${campaign.name} (copia)`,
        }
        set((state) => ({
          campaigns: [duplicated, ...state.campaigns],
        }))
        return duplicated
      },
      resendCampaign: (id) => {
        const now = new Date().toISOString()
        let updatedCampaign: RecommendationCampaign | null = null
        set((state) => ({
          campaigns: state.campaigns.map((campaign) => {
            if (campaign.id !== id) return campaign
            updatedCampaign = {
              ...campaign,
              status: 'Programado',
              scheduledAt: now,
              createdAt: now,
            }
            return updatedCampaign
          }),
        }))
        return updatedCampaign
      },
      exportSelectedContacts: () => {
        const { contacts, selectedContacts } = get()
        return contacts.filter((contact) => selectedContacts.includes(contact.id))
      },
    }),
    {
      name: 'recommendations-storage',
      partialize: (state) => ({
        contacts: state.contacts,
        campaigns: state.campaigns,
        filter: state.filter,
        selectedContacts: state.selectedContacts,
      }),
    }
  )
)
