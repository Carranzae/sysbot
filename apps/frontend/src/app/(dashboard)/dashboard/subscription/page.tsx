'use client'

import { useEffect, useState } from 'react'
import { useBusinessStore } from '@/store/business'
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { 
    Check, 
    Zap, 
    CreditCard, 
    ShieldCheck, 
    Clock, 
    Activity, 
    Server,
    MessageSquare,
    Globe,
    Bot
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { adminApi, businessApi, plansApi } from '@/lib/api'

const PLANS = [
    {
        id: 'FREE',
        name: 'Free / Demo',
        price: 0,
        description: 'Ideal para probar la potencia del sistema.',
        features: ['1 Negocio', '100 Mensajes / mes', 'Soporte vía Ticket', 'IA Básica (Gemini)'],
        color: 'bg-slate-100 text-slate-700',
        buttonText: 'Actual',
        recommended: false
    },
    {
        id: 'STARTER',
        name: 'Starter',
        price: 19,
        description: 'Perfecto para emprendedores individuales.',
        features: ['1 Negocio', '500 Mensajes / mes', 'WhatsApp Web', 'IA Avanzada (Groq)', 'Soporte Prioritario'],
        color: 'bg-blue-100 text-blue-700',
        buttonText: 'Mejorar',
        recommended: false
    },
    {
        id: 'PROFESSIONAL',
        name: 'Professional',
        price: 49,
        description: 'La opción favorita de las PyMEs en crecimiento.',
        features: ['3 Negocios', '2,000 Mensajes / mes', 'WhatsApp API Cloud', 'RAG (Base de Conocimientos)', 'Multi-agente'],
        color: 'bg-indigo-600 text-white',
        buttonText: 'Mejorar',
        recommended: true
    },
    {
        id: 'BUSINESS',
        name: 'Business',
        price: 99,
        description: 'Para empresas que buscan automatización total.',
        features: ['10 Negocios', 'Mensajes Ilimitados*', 'Voz e IA (TTS)', 'CRM Integrado', 'Account Manager Dedicado'],
        color: 'bg-emerald-100 text-emerald-700',
        buttonText: 'Mejorar',
        recommended: false
    }
]

export default function SubscriptionPage() {
    const { selectedBusiness } = useBusinessStore()
    const { toast } = useToast()
    const [loading, setLoading] = useState(true)
    const [stats, setStats] = useState<any>(null)
    const [currentPlan, setCurrentPlan] = useState<any>(null)

    useEffect(() => {
        if (selectedBusiness?.id) {
            loadSubscriptionData()
        }
    }, [selectedBusiness])

    const loadSubscriptionData = async () => {
        try {
            setLoading(true)
            
            // Cargar suscripción real
            const subscription = await plansApi.getMySubscription()
            
            setCurrentPlan({
                type: subscription.planType || 'FREE',
                expiresAt: subscription.currentPeriodEnd,
                isActive: subscription.status === 'ACTIVE'
            })

            // Cargar métricas de uso reales
            const metricsResponse = await businessApi.getMetrics(selectedBusiness!.id)
            setStats(metricsResponse.data)
        } catch (error) {
            console.error('Error loading subscription:', error)
            // Fallback si falla el endpoint nuevo
            setCurrentPlan({ type: 'FREE', isActive: true })
        } finally {
            setLoading(false)
        }
    }

    const handleUpgrade = async (planId: string) => {
        if (planId === currentPlan?.type) return

        try {
            toast({
                title: "Iniciando Pago",
                description: "Estamos generando tu sesión de pago segura...",
            })

            const response = await plansApi.createCheckout(planId, 'MONTHLY', selectedBusiness?.id)
            
            if (response.paymentUrl) {
                toast({
                    title: "Redirigiendo",
                    description: "Serás redirigido a la pasarela de pago en un momento.",
                })
                // Redirigir a IziPay/Stripe
                window.location.href = response.paymentUrl
            } else {
                throw new Error('No se recibió URL de pago')
            }
        } catch (error: any) {
            toast({
                title: "Error de Pago",
                description: error.response?.data?.message || "No se pudo iniciar el pago. Contacta a soporte.",
                variant: "destructive"
            })
        }
    }

    if (!selectedBusiness) return <div className="p-8 text-center text-gray-500">Selecciona un negocio para ver su suscripción.</div>

    return (
        <div className="space-y-8 pb-12">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">Suscripción y Plan</h1>
                    <p className="text-gray-500">Gestiona tu plan de servicio para {selectedBusiness.name}</p>
                </div>
                <Badge variant={currentPlan?.isActive ? "success" : "destructive"} className="px-4 py-1 text-sm">
                    {currentPlan?.isActive ? "Suscripción Activa" : "Suscripción Inactiva"}
                </Badge>
            </div>

            {/* Current Plan Overview */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <Card className="lg:col-span-1 border-indigo-100 bg-gradient-to-br from-white to-indigo-50/30">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <ShieldCheck className="h-5 w-5 text-indigo-600" />
                            Plan Actual
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex justify-between items-end">
                            <div>
                                <p className="text-4xl font-black text-indigo-900">{currentPlan?.type || 'FREE'}</p>
                                <p className="text-xs text-indigo-600 uppercase font-bold mt-1">Siguiente Pago</p>
                                <p className="text-sm font-medium text-gray-700">
                                    {currentPlan?.expiresAt ? new Date(currentPlan.expiresAt).toLocaleDateString() : 'N/A'}
                                </p>
                            </div>
                            <div className="text-right">
                                <CreditCard className="h-8 w-8 text-indigo-200" />
                            </div>
                        </div>
                        <div className="pt-4 border-t border-indigo-100 flex items-center gap-2 text-sm text-gray-600">
                            <Clock className="h-4 w-4" />
                            <span>Ciclo de facturación: Mensual</span>
                        </div>
                    </CardContent>
                </Card>

                <Card className="lg:col-span-2">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-sm font-bold uppercase text-gray-500">
                            <Activity className="h-4 w-4" />
                            Consumo de este mes
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="grid md:grid-cols-2 gap-8">
                        <div className="space-y-3">
                            <div className="flex justify-between text-sm font-medium">
                                <span className="flex items-center gap-2">
                                    <MessageSquare className="h-4 w-4 text-blue-500" />
                                    Mensajes Enviados
                                </span>
                                <span>{stats?.messagesSent || 0} / {stats?.messageLimit || 100}</span>
                            </div>
                            <Progress value={((stats?.messagesSent || 0) / (stats?.messageLimit || 100)) * 100} className="h-2 bg-blue-100" />
                            <p className="text-[10px] text-gray-400">Renueva el 1ro de cada mes</p>
                        </div>
                        <div className="space-y-3">
                            <div className="flex justify-between text-sm font-medium">
                                <span className="flex items-center gap-2">
                                    <Bot className="h-4 w-4 text-emerald-500" />
                                    Tokens de IA (RAG)
                                </span>
                                <span>{stats?.aiTokensUsed || 0} / {stats?.aiTokensLimit || 5000}</span>
                            </div>
                            <Progress value={((stats?.aiTokensUsed || 0) / (stats?.aiTokensLimit || 5000)) * 100} className="h-2 bg-emerald-100" />
                            <p className="text-[10px] text-gray-400">Consumo total acumulado</p>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Plans Table */}
            <div>
                <div className="text-center mb-8">
                    <h2 className="text-2xl font-bold text-gray-900">Escala tu Negocio con IA</h2>
                    <p className="text-gray-500">Selecciona el plan que mejor se adapte a tus necesidades de crecimiento.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    {PLANS.map((plan) => (
                        <Card 
                            key={plan.id} 
                            className={`flex flex-col relative overflow-hidden transition-all duration-300 hover:shadow-xl hover:-translate-y-1 ${
                                plan.recommended ? 'border-indigo-500 ring-2 ring-indigo-500/20' : 'border-gray-200'
                            } ${plan.id === currentPlan?.type ? 'bg-indigo-50/20 opacity-80' : ''}`}
                        >
                            {plan.recommended && (
                                <div className="absolute top-0 right-0">
                                    <div className="bg-indigo-600 text-white text-[10px] font-bold px-4 py-1 rotate-45 translate-x-3 translate-y-3 shadow-sm">
                                        RECOMENDADO
                                    </div>
                                </div>
                            )}
                            <CardHeader>
                                <div className="flex items-center justify-between mb-2">
                                    <h3 className="text-xl font-bold">{plan.name}</h3>
                                    {plan.id === currentPlan?.type && (
                                        <Badge variant="success">ACTUAL</Badge>
                                    )}
                                </div>
                                <div className="flex items-baseline gap-1">
                                    <span className="text-4xl font-black">${plan.price}</span>
                                    <span className="text-gray-500 text-sm">/mes</span>
                                </div>
                                <CardDescription className="mt-2 min-h-[40px]">{plan.description}</CardDescription>
                            </CardHeader>
                            <CardContent className="flex-1">
                                <ul className="space-y-3">
                                    {plan.features.map((feature, idx) => (
                                        <li key={idx} className="flex items-start gap-2 text-sm text-gray-600">
                                            <div className="mt-1 rounded-full bg-emerald-50 p-0.5">
                                                <Check className="h-3 w-3 text-emerald-600" />
                                            </div>
                                            {feature}
                                        </li>
                                    ))}
                                </ul>
                            </CardContent>
                            <CardFooter className="pt-6">
                                <Button 
                                    className={`w-full font-bold h-11 ${
                                        plan.id === currentPlan?.type 
                                            ? 'bg-gray-100 text-gray-400 cursor-not-allowed hover:bg-gray-100' 
                                            : plan.recommended ? 'bg-indigo-600 hover:bg-indigo-700 text-white' : ''
                                    }`}
                                    variant={plan.recommended ? "default" : "outline"}
                                    onClick={() => handleUpgrade(plan.id)}
                                    disabled={plan.id === currentPlan?.type}
                                >
                                    {plan.id === currentPlan?.type ? 'Tu Plan Actual' : `Elegir ${plan.name}`}
                                </Button>
                            </CardFooter>
                        </Card>
                    ))}
                </div>
            </div>

            {/* Trusted by Section */}
            <div className="pt-12 text-center">
                <div className="flex items-center justify-center gap-8 opacity-40 grayscale">
                    <div className="flex items-center gap-2 font-bold text-xl"><Globe className="h-5 w-5"/> Stripe</div>
                    <div className="flex items-center gap-2 font-bold text-xl"><Zap className="h-5 w-5"/> IziPay</div>
                    <div className="flex items-center gap-2 font-bold text-xl"><Server className="h-5 w-5"/> Amazon Web Services</div>
                </div>
                <p className="text-xs text-gray-400 mt-6 italic">
                    Todos los pagos son procesados de forma segura bajo estándares PCI-DSS. No almacenamos tus datos de tarjeta.
                </p>
            </div>
        </div>
    )
}
