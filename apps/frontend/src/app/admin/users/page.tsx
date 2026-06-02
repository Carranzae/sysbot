'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { adminApi } from '@/lib/api'
import { useEffect, useState } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Search, Loader2 } from 'lucide-react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'
import { Badge } from "@/components/ui/badge"
import { BusinessFeaturesDialog } from "@/components/admin/business-features-dialog"
import { Settings } from "lucide-react"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"

const CHANNEL_PERMISSIONS = [
    { key: 'WHATSAPP', label: 'WhatsApp' },
    { key: 'MESSENGER', label: 'Messenger' },
    { key: 'INSTAGRAM', label: 'Instagram' },
]

const formatDate = (date?: string | null) => {
    if (!date) return 'Sin fecha definida'
    const parsed = new Date(date)
    if (Number.isNaN(parsed.getTime())) return 'Sin fecha definida'
    return parsed.toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' })
}

const getPlanStatus = (business: any) => {
    const planExpirationDate = business?.planExpiresAt ? new Date(business.planExpiresAt) : null
    const planExpired = planExpirationDate ? planExpirationDate.getTime() < Date.now() : false
    if (business?.isActive === false) {
        return { label: 'Suspendido', variant: 'destructive' as const }
    }
    if (planExpired) {
        return { label: 'Vencido', variant: 'secondary' as const }
    }
    if (planExpirationDate) {
        return { label: 'Activo', variant: 'success' as const }
    }
    return { label: 'Sin fecha', variant: 'outline' as const }
}

export default function AdminUsersPage() {
    const { toast } = useToast()
    const [users, setUsers] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState('')
    const [rubroFilter, setRubroFilter] = useState('')

    async function loadUsers() {
        try {
            setLoading(true)
            const { data } = await adminApi.getUsers({ search, rubro: rubroFilter })
            setUsers(data)
        } catch (e) {
            console.error('Failed to load users', e)
            toast({ title: 'Error', description: 'No se pudieron cargar los usuarios', variant: 'destructive' })
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        // Debounce or just load on mount
        loadUsers()
    }, []) // Simplification: Manual refresh or enter to search

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault()
        loadUsers()
    }

    const [selectedBusiness, setSelectedBusiness] = useState<any>(null)
    const [isFeatureDialogOpen, setIsFeatureDialogOpen] = useState(false)
    const [deletingUserId, setDeletingUserId] = useState<string | null>(null)
    const [deletingBusinessId, setDeletingBusinessId] = useState<string | null>(null)

    const handleManageBusiness = (business: any) => {
        setSelectedBusiness(business)
        setIsFeatureDialogOpen(true)
    }

    const handleRoleChange = async (userId: string, newRole: string) => {
        try {
            await adminApi.updateUserRole(userId, newRole)
            toast({ title: 'Rol actualizado', description: 'El rol del usuario ha sido cambiado.' })
            loadUsers() // Reload to confirm
        } catch (e) {
            toast({ title: 'Error', description: 'No se pudo actualizar el rol', variant: 'destructive' })
        }
    }

    const handleDeleteUser = async (user: any) => {
        const confirmed = window.confirm(`¿Eliminar al usuario ${user.email}? Se eliminarán sus negocios asociados.`)
        if (!confirmed) return

        try {
            setDeletingUserId(user.id)
            await adminApi.deleteUser(user.id)
            toast({ title: 'Usuario eliminado', description: `${user.email} fue eliminado correctamente.` })
            loadUsers()
        } catch (e) {
            console.error('Failed to delete user', e)
            toast({ title: 'Error', description: 'No se pudo eliminar el usuario', variant: 'destructive' })
        } finally {
            setDeletingUserId(null)
        }
    }

    const handleDeleteBusiness = async (business: any) => {
        const confirmed = window.confirm(`¿Eliminar el negocio ${business.name}? Esta acción es irreversible.`)
        if (!confirmed) return

        try {
            setDeletingBusinessId(business.id)
            await adminApi.deleteBusiness(business.id)
            toast({ title: 'Negocio eliminado', description: `${business.name} fue eliminado correctamente.` })
            loadUsers()
        } catch (e) {
            console.error('Failed to delete business', e)
            toast({ title: 'Error', description: 'No se pudo eliminar el negocio', variant: 'destructive' })
        } finally {
            setDeletingBusinessId(null)
        }
    }

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-3xl font-bold tracking-tight text-gray-900">Gestión de Usuarios</h1>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Usuarios del Sistema</CardTitle>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSearch} className="flex gap-4 mb-6">
                        <div className="relative flex-1">
                            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-500" />
                            <Input
                                placeholder="Buscar por nombre o email..."
                                className="pl-9"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                            />
                        </div>
                        <Button type="submit" disabled={loading}>
                            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Buscar'}
                        </Button>
                    </form>

                    <div className="rounded-md border">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Usuario</TableHead>
                                    <TableHead>Email</TableHead>
                                    <TableHead>Rol</TableHead>
                                    <TableHead>Estado</TableHead>
                                    <TableHead>Negocios</TableHead>
                                    <TableHead>Fecha Registro</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {users.map((user) => (
                                    <TableRow key={user.id}>
                                        <TableCell className="font-medium">
                                            {user.firstName} {user.lastName}
                                        </TableCell>
                                        <TableCell className="text-gray-500">{user.email}</TableCell>
                                        <TableCell>
                                            <Badge variant={user.isActive ? "success" : "destructive"}>
                                                {user.isActive ? "Activo" : "Suspendido"}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>
                                            <Select
                                                defaultValue={user.role}
                                                onValueChange={(val) => handleRoleChange(user.id, val)}
                                            >
                                                <SelectTrigger className="w-[140px]">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="SUPER_ADMIN">SUPER ADMIN</SelectItem>
                                                    <SelectItem value="ADMIN">ADMIN</SelectItem>
                                                    <SelectItem value="BUSINESS_OWNER">DUEÑO NEGOCIO</SelectItem>
                                                    <SelectItem value="STAFF">STAFF</SelectItem>
                                                    <SelectItem value="USER">USUARIO</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </TableCell>
                                        <TableCell>
                                            {user.businesses?.length > 0 ? (
                                                <div className="flex flex-col gap-3">
                                                    {user.businesses.map((b: any) => {
                                                        const { label, variant } = getPlanStatus(b)
                                                        const channels = b.allowedSocials || []
                                                        return (
                                                            <div key={b.id} className="rounded-lg border p-3 space-y-2">
                                                                <div className="flex items-start justify-between gap-2">
                                                                    <div>
                                                                        <p className="text-sm font-medium text-gray-900">{b.name} <span className="text-gray-500 text-xs">({b.industryType})</span></p>
                                                                        <p className="text-xs text-gray-500">Plan vence: {formatDate(b.planExpiresAt)}</p>
                                                                    </div>
                                                                    <Badge variant={variant}>{label}</Badge>
                                                                </div>
                                                                <div>
                                                                    <p className="text-[11px] uppercase tracking-wide text-gray-500 mb-1">Canales permitidos</p>
                                                                    {channels.length > 0 ? (
                                                                        <div className="flex flex-wrap gap-1">
                                                                            {CHANNEL_PERMISSIONS.map((channel) => {
                                                                                const enabled = channels.includes(channel.key)
                                                                                return (
                                                                                    <Badge
                                                                                        key={channel.key}
                                                                                        variant={enabled ? 'secondary' : 'outline'}
                                                                                        className={`text-xs ${enabled ? 'text-emerald-700 bg-emerald-50 border-emerald-200' : ''}`}
                                                                                    >
                                                                                        {channel.label} {enabled ? '✔️' : '🔒'}
                                                                                    </Badge>
                                                                                )
                                                                            })}
                                                                        </div>
                                                                    ) : (
                                                                        <p className="text-xs text-gray-400">Ningún canal habilitado</p>
                                                                    )}
                                                                </div>
                                                                <div className="flex gap-1">
                                                                    <Button
                                                                        variant="outline"
                                                                        size="sm"
                                                                        className="h-7 text-xs"
                                                                        onClick={() => handleManageBusiness(b)}
                                                                    >
                                                                        Configurar
                                                                    </Button>
                                                                    <Button
                                                                        variant="ghost"
                                                                        size="sm"
                                                                        className="h-7 text-xs text-red-500"
                                                                        onClick={() => handleDeleteBusiness(b)}
                                                                        disabled={deletingBusinessId === b.id}
                                                                    >
                                                                        {deletingBusinessId === b.id ? (
                                                                            <Loader2 className="h-3 w-3 animate-spin" />
                                                                        ) : (
                                                                            'Eliminar'
                                                                        )}
                                                                    </Button>
                                                                </div>
                                                            </div>
                                                        )
                                                    })}
                                                </div>
                                            ) : <span className="text-gray-400 italic">Sin negocio</span>}
                                        </TableCell>
                                        <TableCell className="text-gray-500">
                                            {new Date(user.createdAt).toLocaleDateString()}
                                        </TableCell>
                                        <TableCell>
                                            <Button
                                                variant="ghost"
                                                className="text-red-500"
                                                onClick={() => handleDeleteUser(user)}
                                                disabled={deletingUserId === user.id}
                                            >
                                                {deletingUserId === user.id ? (
                                                    <Loader2 className="h-4 w-4 animate-spin" />
                                                ) : (
                                                    'Eliminar'
                                                )}
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                        {users.length === 0 && !loading && (
                            <div className="p-8 text-center text-gray-500">No se encontraron usuarios</div>
                        )}
                    </div>
                </CardContent>
            </Card>
            {selectedBusiness && (
                <BusinessFeaturesDialog
                    business={selectedBusiness}
                    isOpen={isFeatureDialogOpen}
                    onClose={() => setIsFeatureDialogOpen(false)}
                    onUpdate={loadUsers}
                />
            )}
        </div>
    )
}
