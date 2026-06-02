'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { useAuthStore } from '@/store/auth'
import { authApi } from '@/lib/api'
import { useToast } from '@/hooks/use-toast'
import { Shield, Loader2, Lock } from 'lucide-react'

export default function AdminLoginPage() {
    const router = useRouter()
    const { toast } = useToast()
    const setAuth = useAuthStore((state) => state.setAuth)
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

            if (user.role !== 'SUPER_ADMIN') {
                toast({
                    title: 'Acceso Denegado',
                    description: 'Esta área es exclusiva para Super Administradores.',
                    variant: 'destructive',
                })
                setLoading(false)
                return
            }

            setAuth(user, access_token)

            toast({
                title: 'Acceso Autorizado',
                description: 'Bienvenido al panel de control.',
            })

            router.push('/admin')

        } catch (error: any) {
            toast({
                title: 'Error de autenticación',
                description: error.response?.data?.message || 'Credenciales inválidas',
                variant: 'destructive',
            })
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-900 p-4">
            <div className="w-full max-w-md">
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-16 h-16 bg-red-600 rounded-2xl mb-4 shadow-lg shadow-red-900/20">
                        <Shield className="w-8 h-8 text-white" />
                    </div>
                    <h1 className="text-3xl font-bold text-white tracking-tight">SUPER ADMIN</h1>
                    <p className="text-slate-400 mt-2">Acceso Restringido al Sistema</p>
                </div>

                <Card className="shadow-2xl border-slate-800 bg-slate-950 text-slate-200">
                    <CardHeader className="space-y-1">
                        <CardTitle className="text-xl font-bold flex items-center gap-2">
                            <Lock className="w-5 h-5 text-red-500" />
                            Credenciales de Seguridad
                        </CardTitle>
                        <CardDescription className="text-slate-500">
                            Identifícate para gestionar la plataforma
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="email">Usuario Admin</Label>
                                <Input
                                    id="email"
                                    type="email"
                                    placeholder="admin@syst.ai"
                                    value={formData.email}
                                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                    required
                                    disabled={loading}
                                    className="bg-slate-900 border-slate-800 text-white placeholder:text-slate-600 focus-visible:ring-red-600"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="password">Llave de Acceso</Label>
                                <Input
                                    id="password"
                                    type="password"
                                    placeholder="••••••••••••"
                                    value={formData.password}
                                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                    required
                                    disabled={loading}
                                    className="bg-slate-900 border-slate-800 text-white placeholder:text-slate-600 focus-visible:ring-red-600"
                                />
                            </div>
                            <Button type="submit" className="w-full h-11 bg-red-600 hover:bg-red-700 text-white font-bold" disabled={loading}>
                                {loading ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Verificando...
                                    </>
                                ) : (
                                    'Ingresar al Panel'
                                )}
                            </Button>
                        </form>
                    </CardContent>
                    <CardFooter className="flex justify-center border-t border-slate-900 py-4">
                        <p className="text-xs text-slate-600">
                            Acceso monitoreado y registrado por seguridad.
                        </p>
                    </CardFooter>
                </Card>
            </div>
        </div>
    )
}
