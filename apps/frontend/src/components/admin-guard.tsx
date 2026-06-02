'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { useAuthStore } from '@/store/auth'
import { Loader2 } from 'lucide-react'

export function AdminGuard({ children }: { children: React.ReactNode }) {
    const router = useRouter()
    const pathname = usePathname()
    const { user, token } = useAuthStore()
    const [authorized, setAuthorized] = useState(false)

    useEffect(() => {
        if (pathname === '/admin/login') {
            setAuthorized(true)
            return
        }

        if (!token) {
            router.push('/admin/login')
            return
        }

        if (user?.role !== 'SUPER_ADMIN') {
            // If logged in but not admin, go to dashboard or deny
            // For security, maybe just redirect to admin login logic or main dashboard
            if (user) {
                router.push('/dashboard') // Or generic 403
            } else {
                router.push('/admin/login')
            }
            return
        }

        setAuthorized(true)
    }, [user, token, router])

    if (!authorized) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        )
    }

    return <>{children}</>
}
