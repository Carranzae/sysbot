'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/store/auth'
import { useBusinessStore } from '@/store/business'

export default function DebugLoginPage() {
  const router = useRouter()
  const { user, token } = useAuthStore()
  const { businesses, selectedBusiness, loadBusinesses } = useBusinessStore()

  useEffect(() => {
    console.log('🔍 Debug Login Info:', {
      user,
      token,
      businesses,
      selectedBusiness,
      businessesCount: businesses.length
    })

    // Simular redirección
    if (user && token) {
      console.log('🚀 Usuario autenticado, verificando redirección...')
      
      if (user.role === 'SUPER_ADMIN') {
        console.log('→ Debería ir a /admin')
        // router.push('/admin')
      } else if (user.needsOnboarding) {
        console.log('→ Debería ir a /onboarding')
        // router.push('/onboarding')
      } else {
        console.log('→ Debería ir a /dashboard')
        // router.push('/dashboard')
      }
    }
  }, [user, token, businesses, selectedBusiness, router])

  const handleLoadBusinesses = async () => {
    try {
      await loadBusinesses()
      console.log('✅ Negocios cargados')
    } catch (error) {
      console.error('❌ Error cargando negocios:', error)
    }
  }

  const handleRedirect = (path: string) => {
    console.log(`🚀 Redirigiendo a ${path}`)
    router.push(path)
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">Debug Login</h1>
        
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-lg shadow">
            <h2 className="text-xl font-semibold mb-4">Estado de Autenticación</h2>
            <pre className="bg-gray-100 p-4 rounded text-sm overflow-auto">
              {JSON.stringify({ user, token }, null, 2)}
            </pre>
          </div>

          <div className="bg-white p-6 rounded-lg shadow">
            <h2 className="text-xl font-semibold mb-4">Estado de Negocios</h2>
            <pre className="bg-gray-100 p-4 rounded text-sm overflow-auto">
              {JSON.stringify({ 
                businessesCount: businesses.length, 
                selectedBusiness: selectedBusiness?.name || 'None',
                businesses: businesses.map(b => ({ id: b.id, name: b.name }))
              }, null, 2)}
            </pre>
          </div>

          <div className="bg-white p-6 rounded-lg shadow">
            <h2 className="text-xl font-semibold mb-4">Acciones</h2>
            <div className="space-y-4">
              <button
                onClick={handleLoadBusinesses}
                className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
              >
                Cargar Negocios
              </button>
              
              <div className="flex gap-4">
                <button
                  onClick={() => handleRedirect('/dashboard')}
                  className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600"
                >
                  Ir a Dashboard
                </button>
                
                <button
                  onClick={() => handleRedirect('/admin')}
                  className="bg-purple-500 text-white px-4 py-2 rounded hover:bg-purple-600"
                >
                  Ir a Admin
                </button>
                
                <button
                  onClick={() => handleRedirect('/home')}
                  className="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600"
                >
                  Ir a Home
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
