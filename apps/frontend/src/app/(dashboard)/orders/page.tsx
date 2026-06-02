'use client'

import { useEffect, useState, useCallback } from 'react'
import { useBusinessStore } from '@/store/business'
import { ordersApi } from '@/lib/api'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useToast } from '@/hooks/use-toast'
import { ShoppingCart, Package, DollarSign, Building2, User, Phone } from 'lucide-react'
import Link from 'next/link'
import { formatCurrency, formatDateTime } from '@/lib/utils'

const statusColors = {
  PENDING: 'bg-yellow-100 text-yellow-800',
  CONFIRMED: 'bg-blue-100 text-blue-800',
  PROCESSING: 'bg-purple-100 text-purple-800',
  SHIPPED: 'bg-indigo-100 text-indigo-800',
  DELIVERED: 'bg-green-100 text-green-800',
  CANCELLED: 'bg-red-100 text-red-800',
}

const statusLabels = {
  PENDING: 'Pendiente',
  CONFIRMED: 'Confirmado',
  PROCESSING: 'Procesando',
  SHIPPED: 'Enviado',
  DELIVERED: 'Entregado',
  CANCELLED: 'Cancelado',
}

export default function OrdersPage() {
  const { toast } = useToast()
  const selectedBusiness = useBusinessStore((state) => state.selectedBusiness)
  const [orders, setOrders] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [filter, setFilter] = useState<string>('all')

  const loadOrders = useCallback(async () => {
    if (!selectedBusiness) return
    setLoading(true)
    try {
      const response = await ordersApi.getAll(selectedBusiness.id)
      setOrders(response.data)
    } catch (error) {
      toast({
        title: 'Error',
        description: 'No se pudieron cargar los pedidos',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }, [selectedBusiness, toast])

  useEffect(() => {
    if (selectedBusiness) {
      loadOrders()
    }
  }, [selectedBusiness, loadOrders])

  const handleStatusChange = async (id: string, status: string) => {
    try {
      await ordersApi.update(id, { status })
      toast({
        title: 'Pedido actualizado',
        description: 'El estado del pedido se actualizó correctamente',
      })
      loadOrders()
    } catch (error) {
      toast({
        title: 'Error',
        description: 'No se pudo actualizar el pedido',
        variant: 'destructive',
      })
    }
  }

  const filteredOrders = orders.filter((order) => {
    if (filter === 'all') return true
    return order.status === filter
  })

  const totalRevenue = orders
    .filter((o) => o.status !== 'CANCELLED')
    .reduce((sum, o) => sum + o.totalAmount, 0)

  const pendingOrders = orders.filter((o) => o.status === 'PENDING').length

  if (!selectedBusiness) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
        <Building2 className="w-16 h-16 text-gray-400 mb-4" />
        <h2 className="text-2xl font-bold text-gray-900 mb-2">No hay negocio seleccionado</h2>
        <p className="text-gray-600 mb-6">Selecciona un negocio para ver pedidos</p>
        <Link href="/businesses">
          <Button>Ir a Negocios</Button>
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Pedidos</h1>
        <p className="text-gray-600 mt-1">Gestiona los pedidos de tus clientes</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Pedidos</p>
                <p className="text-3xl font-bold text-gray-900 mt-1">{orders.length}</p>
              </div>
              <ShoppingCart className="w-10 h-10 text-blue-600" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Pendientes</p>
                <p className="text-3xl font-bold text-gray-900 mt-1">{pendingOrders}</p>
              </div>
              <Package className="w-10 h-10 text-yellow-600" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Ingresos Totales</p>
                <p className="text-3xl font-bold text-gray-900 mt-1">
                  {formatCurrency(totalRevenue)}
                </p>
              </div>
              <DollarSign className="w-10 h-10 text-green-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Todos los Pedidos</CardTitle>
            <div className="flex space-x-2">
              <Button
                variant={filter === 'all' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFilter('all')}
              >
                Todos
              </Button>
              <Button
                variant={filter === 'PENDING' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFilter('PENDING')}
              >
                Pendientes
              </Button>
              <Button
                variant={filter === 'PROCESSING' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFilter('PROCESSING')}
              >
                Procesando
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">
              <p className="text-gray-500">Cargando pedidos...</p>
            </div>
          ) : filteredOrders.length === 0 ? (
            <div className="text-center py-12">
              <ShoppingCart className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No hay pedidos</h3>
              <p className="text-gray-600">Los pedidos aparecerán aquí cuando los clientes los realicen</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredOrders.map((order) => (
                <div
                  key={order.id}
                  className="border rounded-lg p-4 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-2">
                        <span className="font-mono text-sm font-medium text-gray-900">
                          #{order.orderNumber}
                        </span>
                        <span
                          className={`px-2 py-1 text-xs font-medium rounded ${
                            statusColors[order.status as keyof typeof statusColors]
                          }`}
                        >
                          {statusLabels[order.status as keyof typeof statusLabels]}
                        </span>
                        <span className="text-sm text-gray-600">
                          {formatDateTime(order.createdAt)}
                        </span>
                      </div>
                      <div className="space-y-2">
                        <div className="flex items-center space-x-2 text-sm">
                          <User className="w-4 h-4 text-gray-400" />
                          <span className="font-medium">{order.customerName}</span>
                        </div>
                        <div className="flex items-center space-x-2 text-sm text-gray-600">
                          <Phone className="w-4 h-4 text-gray-400" />
                          <span>{order.customerPhone}</span>
                        </div>
                        <div className="flex items-center space-x-2 text-sm">
                          <DollarSign className="w-4 h-4 text-gray-400" />
                          <span className="font-semibold text-gray-900">
                            {formatCurrency(order.totalAmount)}
                          </span>
                        </div>
                        {order.items && order.items.length > 0 && (
                          <div className="mt-2 pt-2 border-t">
                            <p className="text-xs text-gray-500 mb-1">Productos:</p>
                            <ul className="text-sm text-gray-700 space-y-1">
                              {order.items.map((item: any, idx: number) => (
                                <li key={idx}>
                                  • {item.name} x{item.quantity} - {formatCurrency(item.price)}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {order.deliveryAddress && (
                          <p className="text-sm text-gray-600 mt-2">
                            📍 {order.deliveryAddress}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="ml-4">
                      {order.status === 'PENDING' && (
                        <Button
                          size="sm"
                          onClick={() => handleStatusChange(order.id, 'CONFIRMED')}
                        >
                          Confirmar
                        </Button>
                      )}
                      {order.status === 'CONFIRMED' && (
                        <Button
                          size="sm"
                          onClick={() => handleStatusChange(order.id, 'PROCESSING')}
                        >
                          Procesar
                        </Button>
                      )}
                      {order.status === 'PROCESSING' && (
                        <Button
                          size="sm"
                          onClick={() => handleStatusChange(order.id, 'SHIPPED')}
                        >
                          Enviar
                        </Button>
                      )}
                      {order.status === 'SHIPPED' && (
                        <Button
                          size="sm"
                          onClick={() => handleStatusChange(order.id, 'DELIVERED')}
                        >
                          Entregar
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
