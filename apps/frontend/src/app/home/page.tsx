'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Bot, Presentation, LogOut, User, Settings } from 'lucide-react'
import { useAuthStore } from '@/store/auth'
import { useState } from 'react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'

export default function Home() {
  const { user, logout } = useAuthStore()
  const router = useRouter()

  const handleLogout = () => {
    logout()
    router.push('/home')
  }

  const getInitials = (firstName: string, lastName: string) => {
    return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase()
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/20 to-teal-50/20 font-syst">
      {/* Header */}
      <header className="container mx-auto px-6 py-6 border-b border-slate-100 bg-white/50 backdrop-blur-md sticky top-0 z-50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/sybot_logo.png" alt="Sybot Logo" className="h-10 w-10 object-contain rounded-xl bg-white p-1 shadow-sm border border-slate-100" />
            <div>
              <span className="text-xl font-extrabold text-slate-800 tracking-tight block leading-none">Sybot</span>
              <span className="text-[9px] font-black tracking-widest text-primary uppercase">Enterprise AI</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {user ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="relative h-10 w-10 rounded-full border border-slate-200 shadow-sm p-0 overflow-hidden group">
                    <Avatar className="h-full w-full">
                      <AvatarFallback className="bg-primary/10 text-primary font-black text-xs font-syst">
                        {getInitials(user.firstName, user.lastName)}
                      </AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-56 bg-white border border-slate-200 shadow-xl rounded-2xl p-1.5" align="end" forceMount>
                  <DropdownMenuLabel className="font-normal p-2.5">
                    <div className="flex flex-col space-y-1">
                      <p className="text-sm font-extrabold text-slate-800 font-syst">
                        {user.firstName} {user.lastName}
                      </p>
                      <p className="text-xs text-slate-400 font-medium font-syst">
                        {user.email}
                      </p>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator className="bg-slate-100 my-1" />
                  <DropdownMenuItem onClick={() => router.push('/dashboard')} className="cursor-pointer rounded-xl focus:bg-slate-50 focus:text-primary font-semibold font-syst p-2.5">
                    <Settings className="mr-2 h-4 w-4" />
                    <span>Panel de Control</span>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator className="bg-slate-100 my-1" />
                  <DropdownMenuItem onClick={handleLogout} className="cursor-pointer rounded-xl text-red-600 focus:text-red-700 focus:bg-red-50 font-semibold font-syst p-2.5">
                    <LogOut className="mr-2 h-4 w-4" />
                    <span>Cerrar Sesión</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <div className="flex items-center gap-2">
                <Link href="/login">
                  <Button variant="ghost" className="rounded-xl font-bold text-slate-600 font-syst">Iniciar Sesión</Button>
                </Link>
                <Link href="/register">
                  <Button className="rounded-xl font-bold font-syst shadow-sm transition-transform duration-300 hover:scale-[1.02]">Comenzar</Button>
                </Link>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="container mx-auto px-6 py-16 md:py-24">
        <div className="text-center max-w-4xl mx-auto">
          {user ? (
            <>
              <h1 className="text-4xl md:text-6xl font-extrabold text-slate-800 mb-6 font-syst tracking-tight">
                ¡Bienvenido de vuelta,<br />
                <span className="bg-gradient-to-r from-primary to-teal-500 bg-clip-text text-transparent">{user.firstName}!</span>
              </h1>
              <p className="text-lg md:text-xl text-slate-500 mb-10 font-medium font-syst max-w-2xl mx-auto leading-relaxed">
                Tu plataforma Sybot está lista. Administra tus negocios, configura tus bots inteligentes y comunícate de forma automatizada.
              </p>

              <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16">
                <Link href="/dashboard">
                  <Button size="lg" className="text-base font-bold px-8 py-4 w-full sm:w-auto rounded-xl shadow-md transition-all hover:translate-y-[-2px]">
                    Ir al Panel de Control
                  </Button>
                </Link>
                <Link href="/businesses">
                  <Button variant="outline" size="lg" className="text-base font-bold px-8 py-4 w-full sm:w-auto rounded-xl shadow-sm border-slate-200 bg-white hover:bg-slate-50 transition-all hover:translate-y-[-2px]">
                    Gestionar Negocios
                  </Button>
                </Link>
              </div>
            </>
          ) : (
            <>
              <h1 className="text-5xl md:text-7xl font-extrabold text-slate-800 mb-6 font-syst tracking-tight">
                Automatiza tu atención<br />con <span className="bg-gradient-to-r from-primary to-teal-500 bg-clip-text text-transparent">Bots Inteligentes</span>
              </h1>
              <p className="text-lg md:text-xl text-slate-500 mb-10 font-medium font-syst max-w-2xl mx-auto leading-relaxed">
                Potencia tu negocio con respuestas automatizadas 24/7 mediante IA avanzada. 
                Gestiona citas, pedidos, leads y call center en un solo panel corporativo.
              </p>

              <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16">
                <Link href="/register">
                  <Button size="lg" className="text-base font-bold px-8 py-4 w-full sm:w-auto rounded-xl shadow-md transition-all hover:translate-y-[-2px]">
                    Comenzar Gratis
                  </Button>
                </Link>
                <Link href="/login">
                  <Button variant="outline" size="lg" className="text-base font-bold px-8 py-4 w-full sm:w-auto rounded-xl shadow-sm border-slate-200 bg-white hover:bg-slate-50 transition-all hover:translate-y-[-2px]">
                    Iniciar Sesión
                  </Button>
                </Link>
              </div>
            </>
          )}

          {/* Features */}
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mt-12 text-left">
            <div className="bg-white/80 backdrop-blur-sm border border-slate-100 p-6 rounded-2xl shadow-sm hover:shadow-md transition-all duration-300 hover:translate-y-[-4px]">
              <div className="w-12 h-12 bg-blue-50 border border-blue-100 rounded-xl flex items-center justify-center mb-5">
                <Bot className="w-6 h-6 text-primary" />
              </div>
              <h3 className="text-lg font-bold text-slate-800 mb-2 font-syst">Respuestas 24/7</h3>
              <p className="text-sm text-slate-500 font-medium font-syst leading-relaxed">
                Asistentes virtuales entrenados con tus propios archivos y bases de datos.
              </p>
            </div>

            <div className="bg-white/80 backdrop-blur-sm border border-slate-100 p-6 rounded-2xl shadow-sm hover:shadow-md transition-all duration-300 hover:translate-y-[-4px]">
              <div className="w-12 h-12 bg-emerald-50 border border-emerald-100 rounded-xl flex items-center justify-center mb-5">
                <svg className="w-6 h-6 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <h3 className="text-lg font-bold text-slate-800 mb-2 font-syst">Pedidos y Citas</h3>
              <p className="text-sm text-slate-500 font-medium font-syst leading-relaxed">
                Módulo completo para agendar turnos y procesar pedidos según tu industria.
              </p>
            </div>

            <div className="bg-white/80 backdrop-blur-sm border border-slate-100 p-6 rounded-2xl shadow-sm hover:shadow-md transition-all duration-300 hover:translate-y-[-4px]">
              <div className="w-12 h-12 bg-amber-50 border border-amber-100 rounded-xl flex items-center justify-center mb-5">
                <Presentation className="w-6 h-6 text-amber-600" />
              </div>
              <h3 className="text-lg font-bold text-slate-800 mb-2 font-syst">CRM & Swarm</h3>
              <p className="text-sm text-slate-500 font-medium font-syst leading-relaxed">
                Control de agentes inteligentes cooperando para atender flujos de trabajo complejos.
              </p>
            </div>

            <div className="bg-white/80 backdrop-blur-sm border border-slate-100 p-6 rounded-2xl shadow-sm hover:shadow-md transition-all duration-300 hover:translate-y-[-4px]">
              <div className="w-12 h-12 bg-violet-50 border border-violet-100 rounded-xl flex items-center justify-center mb-5">
                <svg className="w-6 h-6 text-violet-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <h3 className="text-lg font-bold text-slate-800 mb-2 font-syst">Múltiples Canales</h3>
              <p className="text-sm text-slate-500 font-medium font-syst leading-relaxed">
                Conectividad para WhatsApp Web, WhatsApp Cloud, CRM local y más.
              </p>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-100 bg-white/50 py-8 mt-24">
        <div className="container mx-auto px-6">
          <div className="text-center text-slate-400 text-sm font-semibold font-syst">
            <p>© {new Date().getFullYear()} Sybot Enterprise AI. Todos los derechos reservados.</p>
          </div>
        </div>
      </footer>
    </div>
  )
}
