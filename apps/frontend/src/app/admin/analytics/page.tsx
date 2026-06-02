"use client"

import { useState, useEffect } from "react"
import { adminApi } from "@/lib/api"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"

export default function AnalyticsPage() {
    const [stats, setStats] = useState<any>(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        loadStats()
    }, [])

    const loadStats = async () => {
        try {
            const data = await adminApi.getAnalytics()
            setStats(data)
        } catch (error) {
            console.error(error)
        } finally {
            setLoading(false)
        }
    }

    if (loading) return <div className="p-8">Cargando...</div>

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-3xl font-bold tracking-tight text-gray-900">Analíticas Empresariales</h1>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-6 mb-8">
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium">Total Mensajes</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats?.totalMessages?.toLocaleString() || 0}</div>
                        <p className="text-xs text-muted-foreground">Enviados por todos los negocios</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium">Tokens IA Consumidos</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats?.totalTokens?.toLocaleString() || 0}</div>
                        <p className="text-xs text-muted-foreground">Uso acumulado global</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium">APIs RAG Activas</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-green-600">{stats?.apiBalancer?.activeProviders || 0}</div>
                        <p className="text-xs text-muted-foreground">Proveedores balanceados</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium">Costo APIs/Hora</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-orange-600">${(stats?.apiBalancer?.totalCostPerHour || 0).toFixed(2)}</div>
                        <p className="text-xs text-muted-foreground">Estimado por hora</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium">Estado del Sistema</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className={`text-2xl font-bold ${
                            stats?.systemHealth === 'HEALTHY' ? 'text-green-600' :
                            stats?.systemHealth === 'WARNING' ? 'text-yellow-600' : 'text-red-600'
                        }`}>
                            {stats?.systemHealth || 'UNKNOWN'}
                        </div>
                        <p className="text-xs text-muted-foreground">Monitoreo en tiempo real</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium">Circuit Breakers</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-blue-600">
                            {stats?.circuitBreakers?.filter((cb: any) => cb.state === 'CLOSED').length || 0}/
                            {stats?.circuitBreakers?.length || 0}
                        </div>
                        <p className="text-xs text-muted-foreground">Abiertos/Total</p>
                    </CardContent>
                </Card>
            </div>

            <div className="grid gap-6 md:grid-cols-2 mb-8">
                <Card>
                    <CardHeader>
                        <CardTitle>Top Consumo IA (Tokens)</CardTitle>
                        <CardDescription>Usuarios que más utilizan la inteligencia artificial</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            {stats?.topTokenUsers?.map((conf: any, i: number) => (
                                <div key={i} className="flex justify-between items-center border-b pb-2 last:border-0">
                                    <div>
                                        <p className="font-medium">{conf.business?.name || 'Desconocido'}</p>
                                        <p className="text-xs text-gray-500">{conf.business?.owner?.email}</p>
                                    </div>
                                    <div className="text-right">
                                        <span className="font-bold">{conf.aiTokensUsed?.toLocaleString()}</span>
                                        <p className="text-xs text-gray-400">Tokens</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Top Almacenamiento</CardTitle>
                        <CardDescription>Negocios con mayor uso de disco</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            {stats?.topStorageUsers?.map((bus: any, i: number) => (
                                <div key={i} className="flex justify-between items-center border-b pb-2 last:border-0">
                                    <div>
                                        <p className="font-medium">{bus.name}</p>
                                        <p className="text-xs text-gray-500">{bus.owner?.email}</p>
                                    </div>
                                    <div className="text-right">
                                        <span className="font-bold">{(bus.storageUsed / 1024 / 1024).toFixed(2)} MB</span>
                                        <p className="text-xs text-gray-400">Usado</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* 🚀 NUEVO: Métricas en Tiempo Real */}
            <div className="grid gap-6 md:grid-cols-2 mb-8">
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            📊 Métricas en Tiempo Real
                            <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                                Últimos 5 minutos
                            </span>
                        </CardTitle>
                        <CardDescription>
                            Rendimiento actual del sistema
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            <div className="flex justify-between items-center">
                                <span className="text-sm text-gray-600">Total de Solicitudes</span>
                                <span className="font-semibold">{stats?.realtime?.totalRequests || 0}</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-sm text-gray-600">Tiempo Promedio de Respuesta</span>
                                <span className="font-semibold">{stats?.realtime?.avgResponseTime?.toFixed(0) || 0}ms</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-sm text-gray-600">Tasa de Error</span>
                                <span className={`font-semibold ${stats?.realtime?.errorRate > 0.05 ? 'text-red-600' : 'text-green-600'}`}>
                                    {(stats?.realtime?.errorRate * 100)?.toFixed(1) || 0}%
                                </span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-sm text-gray-600">Solicitudes por Segundo</span>
                                <span className="font-semibold">{stats?.realtime?.requestsPerSecond?.toFixed(1) || 0}</span>
                            </div>

                            {stats?.realtime?.slowestEndpoints?.length > 0 && (
                                <div className="mt-4">
                                    <h4 className="text-sm font-medium text-gray-700 mb-2">Endpoints Más Lentos</h4>
                                    <div className="space-y-1">
                                        {stats.realtime.slowestEndpoints.slice(0, 3).map((endpoint: any, i: number) => (
                                            <div key={i} className="flex justify-between text-xs">
                                                <span className="truncate flex-1">{endpoint.endpoint}</span>
                                                <span className="font-medium">{endpoint.avgTime.toFixed(0)}ms</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            🚨 Alertas Activas
                            <span className="text-xs bg-red-100 text-red-800 px-2 py-1 rounded">
                                {stats?.alerts?.length || 0} activas
                            </span>
                        </CardTitle>
                        <CardDescription>
                            Problemas que requieren atención inmediata
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        {stats?.alerts?.length > 0 ? (
                            <div className="space-y-3">
                                {stats.alerts.slice(0, 5).map((alert: any, i: number) => (
                                    <div key={i} className="border rounded-lg p-3 bg-red-50 border-red-200">
                                        <div className="flex justify-between items-start mb-2">
                                            <h4 className="font-medium text-red-800 text-sm">{alert.message}</h4>
                                            <span className={`text-xs px-2 py-1 rounded ${
                                                alert.severity === 'CRITICAL' ? 'bg-red-200 text-red-800' :
                                                alert.severity === 'HIGH' ? 'bg-orange-200 text-orange-800' :
                                                'bg-yellow-200 text-yellow-800'
                                            }`}>
                                                {alert.severity}
                                            </span>
                                        </div>
                                        <p className="text-xs text-gray-600 mb-2">{alert.type}</p>
                                        <p className="text-xs text-gray-500">
                                            {new Date(alert.createdAt).toLocaleString()}
                                        </p>
                                    </div>
                                ))}
                                {stats.alerts.length > 5 && (
                                    <p className="text-xs text-gray-500 text-center">
                                        +{stats.alerts.length - 5} alertas más...
                                    </p>
                                )}
                            </div>
                        ) : (
                            <div className="text-center py-8 text-green-600">
                                <div className="text-4xl mb-2">✅</div>
                                <p className="text-sm">No hay alertas activas</p>
                                <p className="text-xs text-gray-500">El sistema está funcionando correctamente</p>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* 🚀 SESIÓN #1: Dashboard del Balanceador de APIs */}
            <Card className="mb-8">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        ⚖️ Balanceador de APIs RAG
                        <span className="text-sm font-normal text-gray-500">
                            ({stats?.apiBalancer?.providers?.length || 0} proveedores)
                        </span>
                    </CardTitle>
                    <CardDescription>
                        Estado en tiempo real de los proveedores de embeddings balanceados
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="space-y-4">
                        {stats?.apiBalancer?.providers?.map((provider: any, i: number) => (
                            <div key={i} className="border rounded-lg p-4">
                                <div className="flex justify-between items-start mb-2">
                                    <div className="flex items-center gap-3">
                                        <div className={`w-3 h-3 rounded-full ${
                                            provider.isActive ? 'bg-green-500' : 'bg-red-500'
                                        }`}></div>
                                        <div>
                                            <h4 className="font-semibold">{provider.name}</h4>
                                            <p className="text-sm text-gray-500">
                                                Prioridad: {provider.priority} | Latencia: {provider.avgLatency}ms
                                            </p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-sm font-medium">
                                            {provider.usedTokens?.toLocaleString()} / {provider.quotaLimit?.toLocaleString()} tokens
                                        </div>
                                        <div className="text-xs text-gray-500">
                                            ${provider.costPerToken?.toFixed(6)} por token
                                        </div>
                                    </div>
                                </div>

                                {/* Barra de progreso de uso */}
                                <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
                                    <div
                                        className={`h-2 rounded-full ${
                                            provider.usagePercent > 90 ? 'bg-red-500' :
                                            provider.usagePercent > 70 ? 'bg-yellow-500' : 'bg-green-500'
                                        }`}
                                        style={{ width: `${Math.min(provider.usagePercent, 100)}%` }}
                                    ></div>
                                </div>

                                <div className="flex justify-between text-xs text-gray-500">
                                    <span>{provider.usagePercent?.toFixed(1)}% usado</span>
                                    <span>Errores: {provider.errorCount || 0}</span>
                                    <span>Último uso: {provider.lastUsed ? new Date(provider.lastUsed).toLocaleTimeString() : 'Nunca'}</span>
                                </div>
                            </div>
                        )) || (
                            <div className="text-center py-8 text-gray-500">
                                <p>No hay proveedores de embeddings configurados</p>
                                <p className="text-sm">Configura APIs en el panel de configuración</p>
                            </div>
                        )}
                    </div>

                    {stats?.apiBalancer?.providers?.length > 0 && (
                        <div className="mt-6 pt-4 border-t">
                            <div className="grid grid-cols-3 gap-4 text-center">
                                <div>
                                    <div className="text-2xl font-bold text-blue-600">
                                        {stats.apiBalancer.providers.filter((p: any) => p.isActive).length}
                                    </div>
                                    <div className="text-sm text-gray-500">Activos</div>
                                </div>
                                <div>
                                    <div className="text-2xl font-bold text-green-600">
                                        ${(stats.apiBalancer.totalCostPerHour || 0).toFixed(2)}
                                    </div>
                                    <div className="text-sm text-gray-500">Costo/Hora</div>
                                </div>
                                <div>
                                    <div className="text-2xl font-bold text-orange-600">
                                        {stats.apiBalancer.totalQuotaUsed?.toFixed(1)}%
                                    </div>
                                    <div className="text-sm text-gray-500">Quota Promedio</div>
                                </div>
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}
