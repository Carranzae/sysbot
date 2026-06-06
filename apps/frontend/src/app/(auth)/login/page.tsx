'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { useAuthStore } from '@/store/auth'
import { useBusinessStore } from '@/store/business'
import { authApi } from '@/lib/api'
import { getApiErrorMessage } from '@/lib/errors'
import { useToast } from '@/hooks/use-toast'
import { Bot, Loader2 } from 'lucide-react'

export default function LoginPage() {
  const router = useRouter()
  const { toast } = useToast()
  const setAuth = useAuthStore((state) => state.setAuth)
  const { loadBusinesses } = useBusinessStore()
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const response = await authApi.login({ email: formData.email, password: formData.password })
      const { access_token, user } = response.data

      setAuth(user, access_token)

      toast({
        title: '¡Bienvenido!',
        description: `Hola ${user.firstName}, has iniciado sesión correctamente.`,
      })

      // Redirigir según el rol y si tiene negocios
      console.log('🔍 Redirigiendo usuario:', {
        role: user.role,
        needsOnboarding: user.needsOnboarding,
        firstName: user.firstName
      });

      if (user.role === 'SUPER_ADMIN') {
        console.log('🚀 Redirigiendo a /admin');
        router.push('/admin');
      } else {
        // Para BUSINESS_OWNER: verificar si tiene negocios
        console.log('🔍 Verificando si tiene negocios...');
        
        try {
          // Cargar negocios del usuario y obtener el resultado actualizado
          await loadBusinesses();
          
          // Obtener los negocios actualizados del store
          const { businesses } = useBusinessStore.getState();
          
          console.log('📊 Negocios cargados:', businesses.length);
          
          if (businesses.length > 0) {
            console.log('✅ Tiene negocios, redirigiendo a /home');
            router.push('/home');
          } else {
            console.log('📝 No tiene negocios, redirigiendo a /onboarding');
            router.push('/onboarding');
          }
        } catch (error) {
          console.error('❌ Error cargando negocios:', error);
          // Si hay error, redirigir a onboarding por seguridad
          router.push('/onboarding');
        }
      }
    } catch (error) {
      toast({
        title: 'Error al iniciar sesión',
        description: getApiErrorMessage(error, 'Credenciales incorrectas'),
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50/20 to-teal-50/20 p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center mb-4">
            <img src="/sybot_logo.png" alt="Sybot Logo" className="h-16 w-16 object-contain rounded-2xl shadow-md bg-white p-2 border border-slate-100/50" />
          </div>
          <h1 className="text-3xl font-extrabold text-slate-800 font-syst">Sybot</h1>
          <p className="text-primary font-black uppercase tracking-widest text-xs mt-1 font-syst">Enterprise AI</p>
        </div>

        <Card className="shadow-xl border border-slate-100 rounded-2xl bg-white/80 backdrop-blur-md">
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl font-extrabold text-slate-800 font-syst">Iniciar Sesión</CardTitle>
            <CardDescription className="font-syst text-slate-500">
              Ingresa tus credenciales para acceder al panel
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email" className="font-semibold text-slate-600 font-syst">Correo Electrónico</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="tu@email.com"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  required
                  disabled={loading}
                  className="h-11 rounded-xl border-slate-200 focus:border-primary/50 font-syst"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password" className="font-semibold text-slate-600 font-syst">Contraseña</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  required
                  disabled={loading}
                  className="h-11 rounded-xl border-slate-200 focus:border-primary/50 font-syst"
                />
              </div>
              <Button type="submit" className="w-full h-11 rounded-xl font-bold font-syst shadow-sm transition-all duration-300" disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Iniciando sesión...
                  </>
                ) : (
                  'Iniciar Sesión'
                )}
              </Button>
            </form>
          </CardContent>
          <CardFooter className="flex flex-col space-y-4">
            <div className="text-sm text-center text-slate-500 font-syst">
              ¿No tienes una cuenta?{' '}
              <Link href="/register" className="text-primary font-bold hover:underline">
                Regístrate aquí
              </Link>
            </div>
          </CardFooter>
        </Card>

        <p className="text-center text-sm text-slate-400 mt-8 font-syst">
          © {new Date().getFullYear()} Sybot Enterprise AI. Todos los derechos reservados.
        </p>
      </div>
    </div>
  )
}
