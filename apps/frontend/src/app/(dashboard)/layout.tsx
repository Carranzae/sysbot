'use client'

import { useEffect } from 'react'
import { Sidebar } from '@/components/dashboard/sidebar'
import { DashboardShell } from '@/components/dashboard/shell'
import { OnboardingGuard } from '@/components/onboarding-guard'
import { useBusinessStore } from '@/store/business'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { loadBusinesses } = useBusinessStore()

  // Cargar negocios al montar el layout
  useEffect(() => {
    loadBusinesses()
  }, [loadBusinesses])

  return (
    <OnboardingGuard>
      <div className="min-h-screen bg-transparent">
        <div className="flex min-h-screen">
          <Sidebar />
          <DashboardShell>{children}</DashboardShell>
        </div>
      </div>
    </OnboardingGuard>
  )
}