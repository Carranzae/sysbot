'use client'

import { useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { useAuthStore } from '@/store/auth'
import { useBusinessStore } from '@/store/business'
import { authApi } from '@/lib/api'
import { Loader2 } from 'lucide-react'

export function OnboardingGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const { user, token } = useAuthStore()
  const { loadBusinesses } = useBusinessStore()
  const [checking, setChecking] = useState(true)
  const pathname = usePathname()

  useEffect(() => {
    const checkOnboarding = async () => {
      if (!token || !user) {
        setChecking(false)
        return
      }

      try {
        // Cargar negocios del usuario
        await loadBusinesses()

        // Verificar onboarding
        const response = await authApi.getOnboardingStatus()
        const { needsOnboarding } = response.data

        if (needsOnboarding) {
          console.log('[OnboardingGuard] Usuario necesita onboarding. Path actual:', pathname)
          if (pathname !== '/onboarding') {
            router.push('/onboarding')
          }
        }
      } catch (error) {
        console.error('Error checking onboarding status:', error)
      } finally {
        setChecking(false)
      }
    }

    checkOnboarding()
  }, [token, user, router, loadBusinesses])

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-blue-600" />
          <p className="mt-4 text-gray-600">Cargando...</p>
        </div>
      </div>
    )
  }

  return <>{children}</>
}














