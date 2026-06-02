import Link from 'next/link'
import { Metadata } from 'next'
import { MessageSquare, Headphones, ShieldCheck, ArrowRight } from 'lucide-react'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'

export const metadata: Metadata = {
  title: 'Soporte | SYST',
  description: 'Contacta al equipo de soporte de SYST para activar integraciones y resolver dudas.',
}

const contactOptions = [
  {
    title: 'WhatsApp empresarial',
    description: 'Respuesta en minutos en horario laboral. Ideal para activaciones urgentes.',
    value: '+51 900 123 456',
    href: 'https://wa.me/51900123456',
    cta: 'Escribir por WhatsApp',
  },
  {
    title: 'Correo electrónico',
    description: 'Perfecto para enviar adjuntos o solicitar reportes detallados.',
    value: 'soporte@syst.ai',
    href: 'mailto:soporte@syst.ai',
    cta: 'Enviar correo',
  },
]

const requestSteps = [
  'Cuenta el nombre del negocio y canal que necesitas activar o revisar.',
  'Adjunta capturas/logs si estás reportando un error.',
  'Indica la urgencia (baja, media, crítica) para priorizar la atención.',
]

export default function SupportPage() {
  return (
    <div className="min-h-screen bg-slate-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl space-y-10">
        <header className="space-y-3 text-center">
          <p className="text-sm uppercase tracking-wide text-primary">Soporte SYST</p>
          <h1 className="text-3xl font-semibold text-slate-900 sm:text-4xl">Estamos aquí para ayudarte</h1>
          <p className="text-base text-slate-600">
            Activa integraciones, coordina onboarding o reporta incidencias. Elegimos el mejor canal para responderte rápido.
          </p>
        </header>

        <section className="grid gap-4 md:grid-cols-2">
          {contactOptions.map((option) => (
            <Card key={option.title} className="border-slate-200 shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg text-slate-900">{option.title}</CardTitle>
                <p className="text-sm text-slate-600">{option.description}</p>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="font-mono text-slate-900">{option.value}</p>
                <Button asChild className="w-full">
                  <Link href={option.href} target="_blank" rel="noreferrer">
                    {option.cta}
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </section>

        <Card className="border-slate-200 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl">
              <MessageSquare className="h-5 w-5 text-primary" />
              Cómo solicitar ayuda
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="space-y-3 text-sm text-slate-600">
              {requestSteps.map((step, index) => (
                <li key={index} className="flex gap-3">
                  <span className="mt-0.5 h-5 w-5 rounded-full bg-primary/10 text-center text-[11px] font-semibold text-primary">
                    {index + 1}
                  </span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
            <Separator className="my-6" />
            <div className="flex flex-wrap items-center gap-4 text-sm text-slate-600">
              <div className="flex items-center gap-2">
                <Headphones className="h-4 w-4 text-primary" />
                <span>Horario: Lun-Vie 9:00 – 18:00 (GMT-5)</span>
              </div>
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-emerald-500" />
                <span>Incidencias críticas: 24/7 vía WhatsApp</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl">
              <ArrowRight className="h-5 w-5 text-primary" />
              Recursos útiles
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-slate-600">
            <p>
              ¿Necesitas una guía paso a paso? Visita nuestra <Link href="/docs" className="text-primary underline">documentación</Link>
              {' '}para revisar configuraciones, estados de integraciones y preguntas frecuentes.
            </p>
            <p>
              También puedes revisar el estado de los servicios dentro del Centro de Ayuda del dashboard para confirmar si hay incidencias activas.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
