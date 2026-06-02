'use client'

import { useState, useEffect } from 'react'
import { adminApi } from '@/lib/api'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Progress } from '@/components/ui/progress'
import {
    Activity,
    AlertTriangle,
    CheckCircle,
    XCircle,
    RefreshCw,
    TrendingUp,
    TrendingDown,
    Zap,
    Shield,
    Clock,
    Server
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

export default function MonitoringPage() {
    const { toast } = useToast()
    const [monitoringData, setMonitoringData] = useState<any>(null)
    const [loading, setLoading] = useState(true)
    const [realtime, setRealtime] = useState(true)
    const [lastUpdate, setLastUpdate] = useState<Date>(new Date())

    const formatCurrency = (value: any, fractionDigits = 2) => {
        const number = typeof value === 'number' ? value : Number(value)
        if (isNaN(number)) return '0.00'
        return number.toFixed(fractionDigits)
    }

    const formatNumber = (value: any) => {
        const number = typeof value === 'number' ? value : Number(value)
        if (isNaN(number)) return 0
        return number
    }

    const loadMonitoringData = async () => {
        try {
            setLoading(true)
            const [dashboardData, healthData] = await Promise.all([
                adminApi.getMonitoringDashboard(),
                adminApi.getSystemHealth()
            ])
            setMonitoringData({ ...dashboardData, ...healthData })
            setLastUpdate(new Date())
        } catch (error) {
            console.error('Failed to load monitoring data', error)
            toast({
                title: 'Error',
                description: 'No se pudieron cargar los datos de monitoreo',
                variant: 'destructive'
            })
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        loadMonitoringData()

        // Auto-refresh every 30 seconds if realtime is enabled
        let interval: NodeJS.Timeout
        if (realtime) {
            interval = setInterval(loadMonitoringData, 30000)
        }

        return () => {
            if (interval) clearInterval(interval)
        }
    }, [realtime])

    const getHealthColor = (status: string) => {
        switch (status) {
            case 'HEALTHY': return 'text-green-600 bg-green-100'
            case 'WARNING': return 'text-yellow-600 bg-yellow-100'
            case 'CRITICAL': return 'text-red-600 bg-red-100'
            default: return 'text-gray-600 bg-gray-100'
        }
    }

    const getHealthIcon = (status: string) => {
        switch (status) {
            case 'HEALTHY': return <CheckCircle className="h-4 w-4" />
            case 'WARNING': return <AlertTriangle className="h-4 w-4" />
            case 'CRITICAL': return <XCircle className="h-4 w-4" />
            default: return <Activity className="h-4 w-4" />
        }
    }

    if (loading && !monitoringData) {
        return (
            <div className="space-y-6">
                <div className="flex justify-between items-center">
                    <h1 className="text-3xl font-bold tracking-tight text-gray-900">
                        Monitoreo del Sistema
                    </h1>
                </div>
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
                    {[...Array(4)].map((_, i) => (
                        <Card key={i} className="animate-pulse">
                            <CardHeader className="pb-2">
                                <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                            </CardHeader>
                            <CardContent>
                                <div className="h-8 bg-gray-200 rounded w-1/2 mb-2"></div>
                                <div className="h-3 bg-gray-200 rounded w-full"></div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            </div>
        )
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-gray-900">
                        Monitoreo del Sistema
                    </h1>
                    <p className="text-gray-500 mt-1">
                        Control y monitoreo avanzado en tiempo real
                    </p>
                </div>
                <div className="flex items-center gap-4">
                    <div className="text-sm text-gray-500">
                        Última actualización: {lastUpdate.toLocaleTimeString()}
                    </div>
                    <Button
                        variant={realtime ? "default" : "outline"}
                        size="sm"
                        onClick={() => setRealtime(!realtime)}
                        className="gap-2"
                    >
                        <RefreshCw className={`h-4 w-4 ${realtime ? 'animate-spin' : ''}`} />
                        {realtime ? 'En Vivo' : 'Pausado'}
                    </Button>
                    <Button onClick={loadMonitoringData} variant="outline" size="sm">
                        <RefreshCw className="h-4 w-4 mr-2" />
                        Actualizar
                    </Button>
                </div>
            </div>

            {/* Health Overview */}
            <Card className="border-2">
                <CardHeader>
                    <CardTitle className="flex items-center gap-3">
                        <div className={`p-2 rounded-full ${getHealthColor(monitoringData?.systemHealth)}`}>
                            {getHealthIcon(monitoringData?.systemHealth)}
                        </div>
                        Estado General del Sistema
                        <Badge variant={
                            monitoringData?.systemHealth === 'HEALTHY' ? 'default' :
                            monitoringData?.systemHealth === 'WARNING' ? 'secondary' : 'destructive'
                        }>
                            {monitoringData?.systemHealth || 'UNKNOWN'}
                        </Badge>
                    </CardTitle>
                    <CardDescription>
                        Resumen del estado de salud del sistema y servicios críticos
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                        <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                            <Server className="h-8 w-8 text-blue-600" />
                            <div>
                                <div className="font-semibold">Uptime</div>
                                <div className="text-sm text-gray-600">
                                    {monitoringData?.uptime ? `${Math.floor(monitoringData.uptime / 3600)}h ${Math.floor((monitoringData.uptime % 3600) / 60)}m` : 'N/A'}
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                            <Activity className="h-8 w-8 text-green-600" />
                            <div>
                                <div className="font-semibold">Solicitudes Activas</div>
                                <div className="text-sm text-gray-600">
                                    {monitoringData?.realtime?.totalRequests || 0} en 5 min
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                            <Zap className="h-8 w-8 text-yellow-600" />
                            <div>
                                <div className="font-semibold">Latencia Promedio</div>
                                <div className="text-sm text-gray-600">
                                    {monitoringData?.realtime?.avgResponseTime?.toFixed(0) || 0}ms
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                            <Shield className="h-8 w-8 text-purple-600" />
                            <div>
                                <div className="font-semibold">Circuit Breakers</div>
                                <div className="text-sm text-gray-600">
                                    {Array.isArray(monitoringData?.circuitBreakers) 
                                        ? monitoringData.circuitBreakers.filter((cb: any) => cb.state === 'OPEN').length 
                                        : 0} abiertos
                                </div>
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>

            <Tabs defaultValue="metrics" className="space-y-6">
                <TabsList className="grid w-full grid-cols-4">
                    <TabsTrigger value="metrics" className="gap-2">
                        <TrendingUp className="h-4 w-4" />
                        Métricas
                    </TabsTrigger>
                    <TabsTrigger value="circuit-breakers" className="gap-2">
                        <Shield className="h-4 w-4" />
                        Circuit Breakers
                    </TabsTrigger>
                    <TabsTrigger value="alerts" className="gap-2">
                        <AlertTriangle className="h-4 w-4" />
                        Alertas
                    </TabsTrigger>
                    <TabsTrigger value="costs" className="gap-2">
                        💰 Costos
                    </TabsTrigger>
                </TabsList>

                {/* Métricas en Tiempo Real */}
                <TabsContent value="metrics" className="space-y-6">
                    <div className="grid gap-6 md:grid-cols-2">
                        <Card>
                            <CardHeader>
                                <CardTitle>Rendimiento de APIs</CardTitle>
                                <CardDescription>Métricas de las últimas 5 minutos</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="space-y-2">
                                    <div className="flex justify-between text-sm">
                                        <span>Solicitudes Totales</span>
                                        <span className="font-semibold">{monitoringData?.realtime?.totalRequests || 0}</span>
                                    </div>
                                    <div className="flex justify-between text-sm">
                                        <span>RPS (Solicitudes/Segundo)</span>
                                        <span className="font-semibold">{monitoringData?.realtime?.requestsPerSecond?.toFixed(2) || 0}</span>
                                    </div>
                                    <div className="flex justify-between text-sm">
                                        <span>Tiempo Promedio de Respuesta</span>
                                        <span className="font-semibold">{monitoringData?.realtime?.avgResponseTime?.toFixed(0) || 0}ms</span>
                                    </div>
                                    <div className="flex justify-between text-sm">
                                        <span>Tasa de Error</span>
                                        <span className={`font-semibold ${monitoringData?.realtime?.errorRate > 0.05 ? 'text-red-600' : 'text-green-600'}`}>
                                            {(monitoringData?.realtime?.errorRate * 100)?.toFixed(1) || 0}%
                                        </span>
                                    </div>
                                </div>

                                {monitoringData?.realtime?.statusCodes && (
                                    <div className="mt-6">
                                        <h4 className="text-sm font-medium mb-3">Códigos de Estado HTTP</h4>
                                        <div className="space-y-2">
                                            {Object.entries(monitoringData.realtime.statusCodes)
                                                .sort(([a], [b]) => parseInt(b) - parseInt(a))
                                                .slice(0, 5)
                                                .map(([code, count]) => (
                                                    <div key={code} className="flex justify-between text-sm">
                                                        <span>{code}</span>
                                                        <span className="font-medium">{count as number}</span>
                                                    </div>
                                                ))}
                                        </div>
                                    </div>
                                )}
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle>Endpoints Más Utilizados</CardTitle>
                                <CardDescription>Endpoints con mayor tráfico</CardDescription>
                            </CardHeader>
                            <CardContent>
                                {monitoringData?.realtime?.endpoints ? (
                                    <div className="space-y-3">
                                        {Object.entries(monitoringData.realtime.endpoints)
                                            .sort(([, a], [, b]) => (b as number) - (a as number))
                                            .slice(0, 10)
                                            .map(([endpoint, count]) => (
                                                <div key={endpoint} className="flex justify-between items-center">
                                                    <span className="text-sm font-mono truncate flex-1">{endpoint}</span>
                                                    <Badge variant="secondary">{count as number}</Badge>
                                                </div>
                                            ))}
                                    </div>
                                ) : (
                                    <div className="text-center py-8 text-gray-500">
                                        No hay datos de endpoints disponibles
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </div>

                    {monitoringData?.realtime?.slowestEndpoints?.length > 0 && (
                        <Card>
                            <CardHeader>
                                <CardTitle>Endpoints Más Lentos</CardTitle>
                                <CardDescription>Identifica cuellos de botella de rendimiento</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-4">
                                    {monitoringData.realtime.slowestEndpoints.map((endpoint: any, index: number) => (
                                        <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                                            <div className="flex-1">
                                                <div className="font-mono text-sm truncate">{endpoint.endpoint}</div>
                                                <div className="text-xs text-gray-500">{endpoint.count} solicitudes</div>
                                            </div>
                                            <div className="text-right">
                                                <div className="font-semibold text-lg">{endpoint.avgTime.toFixed(0)}ms</div>
                                                <div className={`text-xs flex items-center gap-1 ${
                                                    endpoint.avgTime > 5000 ? 'text-red-600' :
                                                    endpoint.avgTime > 2000 ? 'text-yellow-600' : 'text-green-600'
                                                }`}>
                                                    {endpoint.avgTime > 5000 ? <TrendingDown className="h-3 w-3" /> :
                                                     endpoint.avgTime > 2000 ? <Clock className="h-3 w-3" /> :
                                                     <TrendingUp className="h-3 w-3" />}
                                                    {endpoint.avgTime > 5000 ? 'Crítico' :
                                                     endpoint.avgTime > 2000 ? 'Lento' : 'Bueno'}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>
                    )}
                </TabsContent>

                {/* Circuit Breakers */}
                <TabsContent value="circuit-breakers" className="space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>Estado de Circuit Breakers</CardTitle>
                            <CardDescription>
                                Protección automática contra fallos en servicios externos
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                                {Array.isArray(monitoringData?.circuitBreakers) 
                                    ? monitoringData.circuitBreakers.map((breaker: any) => (
                                    <Card key={breaker.service} className={`border-2 ${
                                        breaker.state === 'OPEN' ? 'border-red-200 bg-red-50' :
                                        breaker.state === 'HALF_OPEN' ? 'border-yellow-200 bg-yellow-50' :
                                        'border-green-200 bg-green-50'
                                    }`}>
                                        <CardHeader className="pb-3">
                                            <CardTitle className="text-lg capitalize flex items-center gap-2">
                                                <div className={`w-3 h-3 rounded-full ${
                                                    breaker.state === 'OPEN' ? 'bg-red-500' :
                                                    breaker.state === 'HALF_OPEN' ? 'bg-yellow-500' :
                                                    'bg-green-500'
                                                }`} />
                                                {breaker.service}
                                            </CardTitle>
                                        </CardHeader>
                                        <CardContent className="pt-0">
                                            <div className="space-y-2">
                                                <div className="flex justify-between text-sm">
                                                    <span>Estado:</span>
                                                    <span className={`font-medium ${
                                                        breaker.state === 'OPEN' ? 'text-red-600' :
                                                        breaker.state === 'HALF_OPEN' ? 'text-yellow-600' :
                                                        'text-green-600'
                                                    }`}>
                                                        {breaker.state}
                                                    </span>
                                                </div>
                                                <div className="flex justify-between text-sm">
                                                    <span>Fallos:</span>
                                                    <span>{breaker.failureCount || 0}</span>
                                                </div>
                                                {breaker.lastFailureTime && (
                                                    <div className="flex justify-between text-sm">
                                                        <span>Último fallo:</span>
                                                        <span className="text-xs text-gray-500">
                                                            {new Date(breaker.lastFailureTime).toLocaleTimeString()}
                                                        </span>
                                                    </div>
                                                )}
                                            </div>
                                        </CardContent>
                                    </Card>
                                ))
                                    : (
                                    <div className="col-span-full text-center py-8 text-gray-500">
                                        No hay circuit breakers configurados
                                    </div>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Alertas */}
                <TabsContent value="alerts" className="space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>Alertas del Sistema</CardTitle>
                            <CardDescription>
                                Historial de alertas y problemas detectados automáticamente
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            {monitoringData?.alerts?.length > 0 ? (
                                <div className="space-y-4">
                                    {monitoringData.alerts.map((alert: any, index: number) => (
                                        <div key={index} className={`border rounded-lg p-4 ${
                                            alert.severity === 'CRITICAL' ? 'border-red-200 bg-red-50' :
                                            alert.severity === 'HIGH' ? 'border-orange-200 bg-orange-50' :
                                            alert.severity === 'MEDIUM' ? 'border-yellow-200 bg-yellow-50' :
                                            'border-blue-200 bg-blue-50'
                                        }`}>
                                            <div className="flex justify-between items-start mb-2">
                                                <h4 className="font-semibold">{alert.message}</h4>
                                                <div className="flex items-center gap-2">
                                                    <Badge variant={
                                                        alert.severity === 'CRITICAL' ? 'destructive' :
                                                        alert.severity === 'HIGH' ? 'secondary' :
                                                        'outline'
                                                    }>
                                                        {alert.severity}
                                                    </Badge>
                                                    {!alert.resolved && (
                                                        <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
                                                    )}
                                                </div>
                                            </div>
                                            <p className="text-sm text-gray-600 mb-2">{alert.type}</p>
                                            <div className="flex justify-between text-xs text-gray-500">
                                                <span>{new Date(alert.createdAt).toLocaleString()}</span>
                                                <span>{alert.resolved ? 'Resuelto' : 'Activo'}</span>
                                            </div>
                                            {alert.data && (
                                                <details className="mt-2">
                                                    <summary className="text-xs cursor-pointer text-gray-600">Ver detalles</summary>
                                                    <pre className="text-xs mt-1 p-2 bg-gray-100 rounded overflow-x-auto">
                                                        {JSON.stringify(alert.data, null, 2)}
                                                    </pre>
                                                </details>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-center py-12">
                                    <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
                                    <h3 className="text-lg font-semibold text-gray-900 mb-2">Sin Alertas Activas</h3>
                                    <p className="text-gray-600">El sistema está funcionando correctamente</p>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Costos */}
                <TabsContent value="costs" className="space-y-6">
                    <div className="grid gap-6 md:grid-cols-2">
                        <Card>
                            <CardHeader>
                                <CardTitle>Análisis de Costos</CardTitle>
                                <CardDescription>
                                    Costos de APIs por período seleccionado
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="text-center p-6 bg-blue-50 rounded-lg">
                                    <div className="text-3xl font-bold text-blue-600 mb-2">
                                        ${formatCurrency(monitoringData?.costs?.totalCost)}
                                    </div>
                                    <div className="text-sm text-blue-600">
                                        Costo total del período
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <div className="flex justify-between text-sm">
                                        <span>Tokens consumidos</span>
                                        <span className="font-semibold">{formatNumber(monitoringData?.costs?.totalTokens).toLocaleString()}</span>
                                    </div>
                                    <div className="flex justify-between text-sm">
                                        <span>Solicitudes totales</span>
                                        <span className="font-semibold">{formatNumber(monitoringData?.costs?.totalRequests).toLocaleString()}</span>
                                    </div>
                                    <div className="flex justify-between text-sm">
                                        <span>Costo promedio por token</span>
                                        <span className="font-semibold">${formatCurrency(monitoringData?.costs?.averageCostPerToken, 6)}</span>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle>Costo por Proveedor</CardTitle>
                                <CardDescription>
                                    Distribución de costos entre proveedores de IA
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                {monitoringData?.costs?.costByProvider?.length > 0 ? (
                                    <div className="space-y-3">
                                        {monitoringData.costs.costByProvider.map((provider: any, index: number) => (
                                            <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                                                <div className="flex-1">
                                                    <div className="font-medium capitalize">
                                                        {provider.provider.replace('_', ' ').toLowerCase()}
                                                    </div>
                                                    <div className="text-xs text-gray-500">
                                                        {provider._sum.tokensUsed?.toLocaleString() || 0} tokens
                                                    </div>
                                                </div>
                                                <div className="text-right">
                                                    <div className="font-semibold text-green-600">
                                                        ${formatCurrency(provider._sum.cost)}
                                                    </div>
                                                    <div className="text-xs text-gray-500">
                                                        {provider._count} requests
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="text-center py-8 text-gray-500">
                                        No hay datos de costos disponibles
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </div>

                    {monitoringData?.costs?.costByBusiness?.length > 0 && (
                        <Card>
                            <CardHeader>
                                <CardTitle>Costo por Negocio</CardTitle>
                                <CardDescription>
                                    Uso de APIs por cada negocio registrado
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-3">
                                    {monitoringData.costs.costByBusiness.map((business: any, index: number) => (
                                        <div key={index} className="flex items-center justify-between p-4 border rounded-lg">
                                            <div className="flex-1">
                                                <div className="font-medium">{business.business?.name || 'Desconocido'}</div>
                                                <div className="text-sm text-gray-600">
                                                    {business.business?.owner?.email || 'Sin email'}
                                                </div>
                                                <div className="text-xs text-gray-500">
                                                    {business._sum.tokensUsed?.toLocaleString() || 0} tokens
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <div className="text-2xl font-bold text-green-600">
                                                    ${formatCurrency(business._sum.cost)}
                                                </div>
                                                <div className="text-sm text-gray-500">
                                                    {business._count} requests
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>
                    )}
                </TabsContent>
            </Tabs>
        </div>
    )
}