'use client'

import { Sparkles, Send, Megaphone, ClipboardCheck } from 'lucide-react'

export type RecommendationChannel = 'whatsapp' | 'email' | 'sms' | 'push' | 'facebook' | 'instagram' | 'tiktok' | 'youtube' | 'linkedin' | 'messenger' | 'instagram_dm'

export type RecommendationTemplate = {
  id: string
  title: string
  description: string
  channelHint: RecommendationChannel[]
  icon: any
}

export type RecommendationConfig = {
  industry: string
  brandAccent: string
  allowedChannels: RecommendationChannel[]
  defaultTemplates: RecommendationTemplate[]
  requiredFields: string[]
  automationPresets: string[]
}

const baseTemplates: RecommendationTemplate[] = [
  {
    id: 'generic_followup',
    title: 'Seguimiento automático',
    description: 'Envía una recomendación a usuarios que consultaron recientemente.',
    channelHint: ['whatsapp', 'email'],
    icon: ClipboardCheck,
  },
  {
    id: 'broadcast',
    title: 'Difusión masiva',
    description: 'Programa un envío para toda tu base de contactos.',
    channelHint: ['whatsapp', 'push'],
    icon: Megaphone,
  },
]

const industryConfigs: Record<string, RecommendationConfig> = {
  RESTAURANT: {
    industry: 'RESTAURANT',
    brandAccent: 'from-rose-500 via-amber-400 to-yellow-300',
    allowedChannels: ['whatsapp', 'messenger', 'instagram_dm', 'email', 'sms', 'facebook', 'instagram', 'tiktok'],
    requiredFields: ['nombre', 'último pedido'],
    automationPresets: ['promo_dia', 'clientes_inactivos'],
    defaultTemplates: [
      {
        id: 'happy_hour',
        title: 'Happy Hour',
        description: 'Promociona combos y bebidas en horario específico.',
        channelHint: ['whatsapp'],
        icon: Sparkles,
      },
      {
        id: 'vip_menu',
        title: 'Menú VIP',
        description: 'Envía el menú exclusivo a clientes frecuentes.',
        channelHint: ['email'],
        icon: Send,
      },
      ...baseTemplates,
    ],
  },
  CLINIC: {
    industry: 'CLINIC',
    brandAccent: 'from-sky-500 via-cyan-400 to-emerald-300',
    allowedChannels: ['whatsapp', 'messenger', 'instagram_dm', 'email', 'facebook', 'instagram'],
    requiredFields: ['consentimiento', 'especialidad'],
    automationPresets: ['recordatorio_cita', 'prevencion'],
    defaultTemplates: [
      {
        id: 'prevention_series',
        title: 'Campaña preventiva',
        description: 'Comparte tips de salud segmentados por especialidad.',
        channelHint: ['email'],
        icon: Sparkles,
      },
      {
        id: 'post_consulta',
        title: 'Post consulta',
        description: 'Solicita feedback o seguimiento después de una cita.',
        channelHint: ['whatsapp'],
        icon: ClipboardCheck,
      },
      ...baseTemplates,
    ],
  },
  DEFAULT: {
    industry: 'DEFAULT',
    brandAccent: 'from-indigo-500 via-purple-500 to-pink-500',
    allowedChannels: ['whatsapp', 'messenger', 'instagram_dm', 'email', 'push', 'facebook', 'instagram', 'tiktok', 'youtube', 'linkedin'],
    requiredFields: [],
    automationPresets: ['seguimiento_consultas'],
    defaultTemplates: baseTemplates,
  },
}

export function getRecommendationConfig(industryType?: string): RecommendationConfig {
  if (!industryType) return industryConfigs.DEFAULT
  return industryConfigs[industryType] ?? industryConfigs.DEFAULT
}
