import Link from 'next/link'
import type { Metadata } from 'next'
import { BookOpen, Cable, Facebook, Instagram, MessageCircle, Settings, ShieldCheck, Sparkles } from 'lucide-react'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { Button } from '@/components/ui/button'

export const metadata: Metadata = {
  title: 'Documentación | SYST',
  description: 'Guías rápidas para configurar tu bot y conectar integraciones con SYST.',
}

const quickGuides = [
  {
    title: '1. Configura tu negocio',
    description: 'Completa datos de marca, horarios y mensajes base para personalizar la IA.',
    href: '/settings',
    icon: Settings,
  },
  {
    title: '2. Conecta WhatsApp',
    description: 'Elige WhatsApp Web o API oficial y sigue el asistente para autenticarte.',
    href: '/settings?tab=whatsapp',
    icon: MessageCircle,
  },
  {
    title: '3. Activa Telegram',
    description: 'Registra el token del bot en el panel admin y verifica el estado desde Canales.',
    href: '/admin/config?tab=telegram',
    icon: Cable,
  },
  {
    title: '4. Integra Messenger',
    description: 'Conecta tu página de Facebook y revisa el estado desde la sección Canales.',
    href: '/channels?view=messenger',
    icon: Facebook,
  },
  {
    title: '5. Activa Instagram Direct',
    description: 'Enlaza tu cuenta business y habilita mensajería desde el centro de canales.',
    href: '/channels?view=instagram',
    icon: Instagram,
  },
]

const integrationHighlights = [
  {
    title: 'Telegram Bot',
    steps: [
      'Crea tu bot con @BotFather y copia el token.',
      'Entra a Configuración → Admin → Telegram e ingresa el token.',
      'Confirma desde la sección Canales que el estado cambió a “Conectado”.',
    ],
  },
  {
    title: 'WhatsApp Web',
    steps: [
      'Ve a Configuración → WhatsApp y elige “WhatsApp Web”.',
      'Escanea el código QR desde la app móvil.',
      'Revisa el estado “READY” en Canales para empezar a responder chats.',
    ],
  },
  {
    title: 'WhatsApp Business API',
    steps: [
      'Solicita la activación desde el Centro de Ayuda → Equipo de soporte.',
      'Completa el proceso de verificación de Meta y asigna un número.',
      'Carga las credenciales en Configuración → WhatsApp API.',
    ],
  },
  {
    title: 'Facebook Messenger',
    steps: [
      'Desde Canales, abre la tarjeta de Messenger y presiona “Conectar con Messenger”.',
      'Ingresa Page ID, Access Token y Verify Token de tu app de Meta.',
      'Verifica que el estado cambie a “Conectado” y envía un mensaje de prueba.',
    ],
  },
  {
    title: 'Instagram Direct',
    steps: [
      'En la tarjeta de Instagram, ingresa el Business Account ID y Access Token.',
      'Autoriza permisos de mensajes en Meta y guarda los cambios.',
      'Comprueba desde Canales que figure como “Conectado” y responde desde Inbox.',
    ],
  },
]

const faq = [
  {
    question: '¿Qué hago si la integración muestra estado “Inactivo”?',
    answer:
      'Verifica que tu plan tenga habilitado el canal (sección Canales). Si ya está habilitado, vuelve a conectar el servicio desde Configuración y revisa los logs en Auditoría.',
  },
  {
    question: '¿Puedo probar los webhooks en local?',
    answer:
      'Sí. Habilita el túnel seguro (ngrok o similar) y actualiza la URL pública en la configuración correspondiente. Recuerda reiniciar la sesión si cambias la URL.',
  },
  {
    question: '¿Dónde reviso los registros de conectarse/desconectarse de Telegram?',
    answer:
      'En el panel Admin → Auditoría verás eventos TELEGRAM_CONNECT y TELEGRAM_DISCONNECT con hora y usuario.',
  },
]

export default function DocsPage() {
  const lastCheck = new Date().toLocaleString('es-PE', {
    day: '2-digit',
    month: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })

  return (
    <div className="min-h-screen bg-slate-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl space-y-10">
        <header className="relative space-y-3 text-center">
          <div className="absolute left-0 top-0">
            <Button size="sm" className="bg-primary text-white hover:bg-primary/90" asChild>
              <Link href="/">Volver al inicio</Link>
            </Button>
          </div>
          <Badge variant="outline" className="gap-2 text-slate-600">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            Centro de ayuda SYST
          </Badge>
          <h1 className="text-3xl font-semibold text-slate-900 sm:text-4xl">Documentación y guías rápidas</h1>
          <p className="text-base text-slate-600">
            Aprende a configurar tu bot, conectar canales y monitorear el estado de la plataforma en minutos.
          </p>
          <div className="flex flex-col items-center justify-center gap-3 sm:flex-row sm:gap-4">
            <Button asChild>
              <Link href="/support">Contactar soporte</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="mailto:soporte@syst.ai">Enviar correo</Link>
            </Button>
          </div>
        </header>

        <section>
          <div className="grid gap-4 md:grid-cols-3">
            {quickGuides.map((guide) => (
              <Card key={guide.title} className="border-slate-200 shadow-sm">
                <CardHeader className="flex flex-row items-center gap-3 pb-3">
                  <guide.icon className="h-5 w-5 text-primary" />
                  <CardTitle className="text-base">{guide.title}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 text-sm text-slate-600">
                  <p>{guide.description}</p>
                  <Button variant="link" className="px-0" asChild>
                    <Link href={guide.href}>Abrir guía</Link>
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        <section className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm uppercase text-slate-500">Integraciones clave</p>
              <h2 className="text-2xl font-semibold text-slate-900">Pasos recomendados</h2>
            </div>
            <Badge className="bg-emerald-100 text-emerald-800">
              <ShieldCheck className="mr-1 h-3.5 w-3.5" />
              Producción estable
            </Badge>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {integrationHighlights.map((item) => (
              <Card key={item.title} className="border-slate-200 shadow-sm">
                <CardHeader>
                  <CardTitle className="text-lg">{item.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <ol className="space-y-3 text-sm text-slate-600">
                    {item.steps.map((step, index) => (
                      <li key={index} className="flex gap-2">
                        <span className="mt-0.5 h-5 w-5 rounded-full bg-primary/10 text-center text-[11px] font-semibold text-primary">
                          {index + 1}
                        </span>
                        <span>{step}</span>
                      </li>
                    ))}
                  </ol>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-3">
          <Card className="border-slate-200 shadow-sm lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl">
                <BookOpen className="h-5 w-5 text-primary" />
                Preguntas frecuentes
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Accordion type="single" collapsible className="w-full">
                {faq.map((item) => (
                  <AccordionItem key={item.question} value={item.question}>
                    <AccordionTrigger className="text-left text-base text-slate-900">
                      {item.question}
                    </AccordionTrigger>
                    <AccordionContent className="text-sm text-slate-600">
                      {item.answer}
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </CardContent>
          </Card>
          <Card className="border-slate-200 shadow-sm">
            <CardHeader>
              <CardTitle className="text-xl">Estado de la plataforma</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm text-slate-600">
              <div className="flex items-center gap-2">
                <span className="inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
                Todos los servicios operativos
              </div>
              <p className="text-xs text-slate-500">Último chequeo: {lastCheck}</p>
              <Separator />
              <p className="text-xs text-slate-500">
                Si detectas intermitencias, avísanos desde el Centro de Ayuda o por WhatsApp al +51 900 123 456.
              </p>
            </CardContent>
          </Card>
        </section>
      </div>
    </div>
  )
}
