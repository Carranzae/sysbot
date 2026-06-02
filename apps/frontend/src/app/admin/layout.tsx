'use client'

import { AdminSidebar } from '@/components/admin/sidebar'
import { AdminHeader } from '@/components/admin/admin-header'
import { AdminGuard } from '@/components/admin-guard'
import { Brain } from 'lucide-react'
import { usePathname } from 'next/navigation'

export default function AdminLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname()

    if (pathname === '/admin/login') {
        return <AdminGuard>{children}</AdminGuard>
    }

    return (
        <AdminGuard>
            <div className="min-h-screen bg-slate-50">
                <div className="flex min-h-screen">
                    <AdminSidebar />
                    <div className="flex flex-1 flex-col">
                        <AdminHeader />
                        <main className="flex-1 bg-slate-50 px-8 py-10">{children}</main>
                    </div>
                </div>
            </div>
        </AdminGuard>
    )
}
