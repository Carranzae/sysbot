'use client'

import { useState, useRef, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAuthStore } from '@/store/auth'
import { useToast } from '@/hooks/use-toast'
import { User, Mail, Phone, Save, ArrowLeft, Camera, Shield, Key, Smartphone, Upload } from 'lucide-react'
import Link from 'next/link'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { authApi, filesApi } from '@/lib/api'

export default function ProfilePage() {
  const { user, setUser } = useAuthStore()
  const { toast } = useToast()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [loading, setLoading] = useState(false)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [changePasswordOpen, setChangePasswordOpen] = useState(false)
  const [twoFactorOpen, setTwoFactorOpen] = useState(false)
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  })
  
  const [formData, setFormData] = useState({
    firstName: user?.firstName || '',
    lastName: user?.lastName || '',
    email: user?.email || '',
    phone: user?.phone || '',
  })

  // Sync formData when user loads
  useEffect(() => {
    if (user) {
      setFormData({
        firstName: user.firstName || '',
        lastName: user.lastName || '',
        email: user.email || '',
        phone: user.phone || '',
      })
    }
  }, [user])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const { data } = await authApi.updateProfile({
        firstName: formData.firstName,
        lastName: formData.lastName,
        phone: formData.phone,
      })
      
      setUser(data)
      
      toast({
        title: 'Perfil actualizado',
        description: 'Tu perfil ha sido actualizado exitosamente',
      })
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.response?.data?.message || 'No se pudo actualizar el perfil',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const handlePasswordChange = (field: string, value: string) => {
    setPasswordData(prev => ({ ...prev, [field]: value }))
  }

  const handleAvatarClick = () => {
    fileInputRef.current?.click()
  }

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validar tipo de archivo
    if (!file.type.startsWith('image/')) {
      toast({
        title: 'Error',
        description: 'Solo se permiten archivos de imagen',
        variant: 'destructive',
      })
      return
    }

    // Validar tamaño (máximo 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: 'Error',
        description: 'La imagen no puede pesar más de 5MB',
        variant: 'destructive',
      })
      return
    }

    setUploadingAvatar(true)
    try {
      const { data } = await authApi.uploadAvatar(file)
      
      // Si la URL es relativa, le ponemos el prefijo del backend
      const baseUrl = process.env.NEXT_PUBLIC_API_URL?.replace('/api/v1', '') || 'http://localhost:3001'
      const finalUser = {
        ...data,
        avatarUrl: data.avatarUrl?.startsWith('/') ? `${baseUrl}${data.avatarUrl}` : data.avatarUrl
      }
      
      setUser(finalUser)
      toast({
        title: 'Avatar actualizado',
        description: 'Tu foto de perfil ha sido actualizada exitosamente.',
      })
    } catch (error) {
      toast({
        title: 'Error',
        description: 'No se pudo actualizar el avatar.',
        variant: 'destructive',
      })
    } finally {
      setUploadingAvatar(false)
    }
  }

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      toast({
        title: 'Error',
        description: 'Las contraseñas no coinciden',
        variant: 'destructive',
      })
      return
    }

    if (passwordData.newPassword.length < 8) {
      toast({
        title: 'Error',
        description: 'La contraseña debe tener al menos 8 caracteres',
        variant: 'destructive',
      })
      return
    }

    try {
      await authApi.updateProfile({
        password: passwordData.newPassword
      })

      toast({
        title: 'Contraseña cambiada',
        description: 'Tu contraseña ha sido cambiada exitosamente',
      })
      setChangePasswordOpen(false)
      setPasswordData({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      })
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.response?.data?.message || 'No se pudo cambiar la contraseña',
        variant: 'destructive',
      })
    }
  }

  const handleTwoFactorSetup = () => {
    toast({
      title: 'Próximamente',
      description: 'La autenticación de dos factores estará disponible pronto',
    })
    setTwoFactorOpen(false)
  }

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <Link href="/dashboard" className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 mb-4">
            <ArrowLeft className="h-4 w-4" />
            Volver al dashboard
          </Link>
          <h1 className="text-3xl font-bold text-gray-900">Mi Perfil</h1>
          <p className="text-gray-600 mt-2">Gestiona tu información personal</p>
        </div>

        {/* Profile Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Información Personal
            </CardTitle>
            <CardDescription>
              Actualiza tus datos personales y de contacto
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Avatar Section */}
              <div className="flex items-center gap-4">
                <div className="relative">
                  <div className="h-20 w-20 rounded-full bg-primary/10 text-primary flex items-center justify-center text-2xl font-semibold">
                    {user?.firstName?.charAt(0)}{user?.lastName?.charAt(0)}
                  </div>
                  <button
                    type="button"
                    onClick={handleAvatarClick}
                    className="absolute bottom-0 right-0 h-8 w-8 rounded-full bg-primary text-white flex items-center justify-center hover:bg-primary/90 transition-colors"
                    disabled={uploadingAvatar}
                  >
                    {uploadingAvatar ? (
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    ) : (
                      <Camera className="h-4 w-4" />
                    )}
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                </div>
                <div>
                  <p className="font-semibold text-gray-900">
                    {user?.firstName} {user?.lastName}
                  </p>
                  <p className="text-sm text-gray-500">{user?.email}</p>
                  <p className="text-xs text-gray-400 mt-1">
                    JPG, PNG o GIF. Máximo 5MB
                  </p>
                </div>
              </div>

              {/* Form Fields */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="firstName">Nombre</Label>
                  <Input
                    id="firstName"
                    value={formData.firstName}
                    onChange={(e) => handleChange('firstName', e.target.value)}
                    placeholder="Tu nombre"
                  />
                </div>
                <div>
                  <Label htmlFor="lastName">Apellido</Label>
                  <Input
                    id="lastName"
                    value={formData.lastName}
                    onChange={(e) => handleChange('lastName', e.target.value)}
                    placeholder="Tu apellido"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="email">Correo Electrónico</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => handleChange('email', e.target.value)}
                  placeholder="tu@email.com"
                  disabled
                />
                <p className="text-xs text-gray-500 mt-1">
                  El correo electrónico no se puede cambiar
                </p>
              </div>

              <div>
                <Label htmlFor="phone">Teléfono</Label>
                <Input
                  id="phone"
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => handleChange('phone', e.target.value)}
                  placeholder="+1234567890"
                />
              </div>

              {/* Account Info */}
              <div className="border-t pt-6">
                <h3 className="font-semibold text-gray-900 mb-4">Información de la Cuenta</h3>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Rol</span>
                    <span className="text-sm font-medium">{user?.role}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Estado</span>
                    <span className="text-sm font-medium text-green-600">
                      Activo
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Miembro desde</span>
                    <span className="text-sm font-medium">
                      {(user as any)?.createdAt ? new Date((user as any).createdAt).toLocaleDateString() : '-'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Submit Button */}
              <div className="flex justify-end gap-3 pt-6">
                <Button variant="outline" type="button">
                  Cancelar
                </Button>
                <Button type="submit" disabled={loading}>
                  {loading ? (
                    <>Guardando...</>
                  ) : (
                    <>
                      <Save className="h-4 w-4 mr-2" />
                      Guardar Cambios
                    </>
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Security Card */}
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Seguridad
            </CardTitle>
            <CardDescription>
              Gestiona la seguridad de tu cuenta
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button 
              variant="outline" 
              className="w-full justify-start" 
              onClick={() => setChangePasswordOpen(true)}
            >
              <Key className="h-4 w-4 mr-2" />
              Cambiar Contraseña
            </Button>
            <Button 
              variant="outline" 
              className="w-full justify-start"
              onClick={() => setTwoFactorOpen(true)}
            >
              <Smartphone className="h-4 w-4 mr-2" />
              Autenticación de Dos Factores
            </Button>
          </CardContent>
        </Card>

        {/* Change Password Dialog */}
        <Dialog open={changePasswordOpen} onOpenChange={setChangePasswordOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Key className="h-5 w-5" />
                Cambiar Contraseña
              </DialogTitle>
              <DialogDescription>
                Ingresa tu contraseña actual y la nueva contraseña
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handlePasswordSubmit} className="space-y-4">
              <div>
                <Label htmlFor="currentPassword">Contraseña Actual</Label>
                <Input
                  id="currentPassword"
                  type="password"
                  value={passwordData.currentPassword}
                  onChange={(e) => handlePasswordChange('currentPassword', e.target.value)}
                  placeholder="Ingresa tu contraseña actual"
                  required
                />
              </div>
              <div>
                <Label htmlFor="newPassword">Nueva Contraseña</Label>
                <Input
                  id="newPassword"
                  type="password"
                  value={passwordData.newPassword}
                  onChange={(e) => handlePasswordChange('newPassword', e.target.value)}
                  placeholder="Mínimo 8 caracteres"
                  required
                />
              </div>
              <div>
                <Label htmlFor="confirmPassword">Confirmar Nueva Contraseña</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  value={passwordData.confirmPassword}
                  onChange={(e) => handlePasswordChange('confirmPassword', e.target.value)}
                  placeholder="Repite la nueva contraseña"
                  required
                />
              </div>
              <div className="flex justify-end gap-3 pt-4">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setChangePasswordOpen(false)}
                >
                  Cancelar
                </Button>
                <Button type="submit">
                  Cambiar Contraseña
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        {/* Two Factor Dialog */}
        <Dialog open={twoFactorOpen} onOpenChange={setTwoFactorOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Smartphone className="h-5 w-5" />
                Autenticación de Dos Factores
              </DialogTitle>
              <DialogDescription>
                Añade una capa extra de seguridad a tu cuenta
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="text-center py-6">
                <Smartphone className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600 mb-4">
                  Protege tu cuenta con autenticación de dos factores usando una app como Google Authenticator o Authy.
                </p>
              </div>
              <div className="flex justify-end gap-3 pt-4">
                <Button 
                  variant="outline" 
                  onClick={() => setTwoFactorOpen(false)}
                >
                  Cancelar
                </Button>
                <Button onClick={handleTwoFactorSetup}>
                  Configurar 2FA
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  )
}
