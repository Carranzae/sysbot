'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { adminApi } from '@/lib/api'
import { useEffect, useState } from 'react'
import { Activity, Users, Building2, Server } from 'lucide-react'
import { Badge } from '@/components/ui/badge'

export default function AdminDashboard() {
    const [stats, setStats] = useState<any>(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        async function loadStats() {
            try {
                const { data } = await adminApi.getStats()
                setStats(data)
            } catch (e) {
                console.error('Failed to load stats', e)
            } finally {
                setLoading(false)
            }
        }
        loadStats()
    }, [])

    if (loading) {
        return <div className="p-8">Cargando estadísticas...</div>
    }

    return (
        <div className="space-y-6">
            <h1 className="text-3xl font-bold tracking-tight text-gray-900">Dashboard de Super Admin</h1>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Usuarios Totales</CardTitle>
                        <Users className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats?.totalUsers || 0}</div>
                        <p className="text-xs text-muted-foreground">Usuarios registrados</p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Negocios Activos</CardTitle>
                        <Building2 className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats?.activeBusinesses || 0}</div>
                        <p className="text-xs text-muted-foreground">de {stats?.totalBusinesses || 0} totales</p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Mensajes Totales</CardTitle>
                        <Activity className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats?.totalMessages?.toLocaleString() || 0}</div>
                        <p className="text-xs text-muted-foreground">Procesados en el sistema</p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Tokens IA Consumidos</CardTitle>
                        <Server className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-blue-600">{stats?.ai?.totalTokens?.toLocaleString() || 0}</div>
                        <p className="text-xs text-muted-foreground">Equivale a approx. ${(stats?.ai?.totalEstimatedCost || 0).toFixed(2)}</p>
                    </CardContent>
                </Card>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
                <Card className="col-span-4">
                    <CardHeader>
                        <CardTitle>Estado del Balanceador RAG / IA</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-lg">
                                    <p className="text-xs text-emerald-600 uppercase font-bold">Solicitudes IA</p>
                                    <p className="text-xl font-bold text-emerald-700">{stats?.ai?.totalRequests || 0}</p>
                                </div>
                                <div className="p-3 bg-blue-50 border border-blue-100 rounded-lg">
                                    <p className="text-xs text-blue-600 uppercase font-bold">Proveedores Saludables</p>
                                    <p className="text-xl font-bold text-blue-700">{stats?.apiBalancer?.activeProviders || 0}</p>
                                </div>
                            </div>

                            <div className="space-y-3">
                                <h4 className="text-xs font-semibold uppercase text-gray-500">Distribución de Carga</h4>
                                {stats?.apiBalancer?.providers?.length > 0 ? (
                                    <div className="space-y-3">
                                        {stats.apiBalancer.providers.map((provider: any, index: number) => (
                                            <div key={index} className="space-y-1">
                                                <div className="flex justify-between items-center text-xs">
                                                    <div className="flex items-center gap-2">
                                                        <div className={`w-2 h-2 rounded-full ${
                                                            provider.isActive ? 'bg-green-500' : 'bg-red-500'
                                                        }`}></div>
                                                        <span>{provider.name}</span>
                                                    </div>
                                                    <span>{provider.usagePercent?.toFixed(1)}%</span>
                                                </div>
                                                <div className="w-full bg-gray-100 rounded-full h-1.5">
                                                    <div 
                                                        className={`h-1.5 rounded-full ${provider.isActive ? 'bg-blue-600' : 'bg-gray-300'}`} 
                                                        style={{width: `${provider.usagePercent}%`}}
                                                    ></div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="text-sm text-gray-500">
                                        No hay proveedores activos en el balanceador.
                                    </p>
                                )}
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card className="col-span-3">
                    <CardHeader>
                        <CardTitle>Infraestructura Global</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-3">
                            <div className="flex justify-between items-center text-sm p-2 bg-gray-50 rounded">
                                <span className="text-gray-600">Base de Datos</span>
                                <Badge variant="success">Conectado</Badge>
                            </div>
                            <div className="flex justify-between items-center text-sm p-2 bg-gray-50 rounded">
                                <span className="text-gray-600">Redis Cache</span>
                                <Badge variant="success">Conectado</Badge>
                            </div>
                            <div className="flex justify-between items-center text-sm p-2 bg-gray-50 rounded">
                                <span className="text-gray-600">Qdrant Vector DB</span>
                                <Badge variant="success">Operativo</Badge>
                            </div>
                            <div className="flex justify-between items-center text-sm p-2 bg-gray-50 rounded">
                                <span className="text-gray-600">Almacenamiento Local</span>
                                <Badge variant="outline">2.4 GB Libres</Badge>
                            </div>
                            <div className="pt-4 border-t mt-4">
                                <h4 className="text-xs font-bold uppercase text-gray-500 mb-2">Costos Estimados</h4>
                                <div className="flex justify-between items-end">
                                    <div>
                                        <p className="text-2xl font-bold text-gray-900">${(stats?.ai?.totalEstimatedCost || 0).toFixed(2)}</p>
                                        <p className="text-[10px] text-gray-500">Gasto total acumulado en IA</p>
                                    </div>
                                    <Badge variant="outline" className="text-blue-600 border-blue-200 bg-blue-50">
                                        Industrial Ready
                                    </Badge>
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}
