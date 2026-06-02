import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'SYST - Sistema Inteligente de Bots',
  description: 'Automatiza la atención al cliente con IA avanzada',
}

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
}

export default function HomeLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}





















