import { NextResponse } from 'next/server'
import { Document, Page, Text, View, StyleSheet, pdf } from '@react-pdf/renderer'

export const dynamic = 'force-dynamic';

const panelSections = [
  {
    title: 'Onboarding del negocio',
    description:
      'Completa el perfil de la empresa: datos legales, logo, rubro, horarios y mensajes base para que la IA responda en el tono correcto.',
    steps: [
      'Desde el selector superior elige el negocio o crea uno nuevo.',
      'Ingresa nombre comercial, industria y datos de contacto en Configuración → Perfil.',
      'Define mensajes de bienvenida, fallback y el horario de atención para automatizar respuestas.',
    ],
  },
  {
    title: 'Dashboard principal',
    description:
      'Monitorea métricas de conversaciones, leads, citas y órdenes. Los widgets se actualizan en tiempo real por negocio.',
    steps: [
      'Selecciona el negocio para filtrar métricas.',
      'Revisa los totales de mensajes, respuestas con IA y KPIs diarios.',
      'Utiliza las acciones rápidas para crear leads, citas o pedidos según el rubro.',
    ],
  },
  {
    title: 'Sección Canales',
    description:
      'Administra el estado de WhatsApp Web/API, Telegram, Messenger e Instagram. Cada tarjeta muestra permisos del plan, estado y accesos directos.',
    steps: [
      'Ve a Dashboard → Canales para revisar las tarjetas disponibles.',
      'Si un canal está bloqueado, solicita upgrade desde la tarjeta correspondiente.',
      'Cuando conectes un canal, verifica el estado (Conectado, Registrado, Inactivo) y la última sincronización.',
    ],
  },
  {
    title: 'Bot Builder e IA',
    description:
      'Configura prompts, flujos y fuentes de conocimiento. El bot builder toma la configuración del negocio y permite habilitar/deshabilitar auto-reply por canal.',
    steps: [
      'Entra a Bot Builder para editar mensajes automáticos y reglas de IA.',
      'Define si el canal usa IA generativa, respuestas rápidas o derivación a agentes.',
      'Guarda y prueba los cambios enviando mensajes desde el canal conectado.',
    ],
  },
  {
    title: 'Centro de ayuda y auditoría',
    description:
      'Desde el panel lateral accede a la documentación, soporte humano y registros de auditoría para QA.',
    steps: [
      'Abre el ícono de ayuda para ver documentación resumida, contactos y estado de plataforma.',
      'Consulta la sección Auditoría (Admin) para ver quién conectó/desconectó canales.',
      'Descarga esta guía en PDF cuando necesites compartirla con el equipo.',
    ],
  },
]

const channelDeepDive = [
  {
    name: 'WhatsApp Web',
    usage: [
      'Configuración → WhatsApp → “WhatsApp Web”. Escanea el QR con tu app móvil.',
      'En Canales verifica que el estado sea READY. Si se desconecta, repite el escaneo.',
      'Ideal para negocios que necesitan una sola sesión y respuesta manual o semiautomática.',
    ],
  },
  {
    name: 'WhatsApp Business API',
    usage: [
      'Solicita activación al soporte SYST e inicia el proceso oficial con Meta.',
      'Cuando tengas número aprobado, carga credenciales en Configuración → WhatsApp API.',
      'Permite múltiples agentes, plantillas oficiales y métricas avanzadas.',
    ],
  },
  {
    name: 'Telegram Bot',
    usage: [
      'Crea un bot con @BotFather y copia el token de acceso.',
      'En Admin → Configuración → Telegram pega el token (opcional: URL pública para el webhook).',
      'Desde Canales confirma el estado “Conectado” y revisa la última sincronización.',
    ],
  },
  {
    name: 'Facebook Messenger',
    usage: [
      'En Canales abre la tarjeta de Messenger y presiona “Conectar con Messenger”.',
      'Ingresa Page ID, Access Token y Verify Token. Guarda para habilitar los webhooks.',
      'Prueba enviando un mensaje a la página y revisa la bandeja unificada.',
    ],
  },
  {
    name: 'Instagram Direct',
    usage: [
      'La cuenta debe ser Instagram Business enlazada a tu página de Facebook.',
      'Carga Business Account ID y Access Token en la tarjeta de Instagram y concede permisos de mensajes.',
      'Comprueba que el estado cambie a “Conectado” y envía mensajes desde la app para validar.',
    ],
  },
]

const supportInfo = [
  'WhatsApp soporte: +51 900 123 456 (urgencias 24/7).',
  'Correo: soporte@syst.ai para tickets detallados o adjuntos.',
  'Centro de Ayuda en el dashboard para monitorear estado y links útiles.',
]

const styles = StyleSheet.create({
  page: {
    padding: 32,
    fontSize: 11,
    fontFamily: 'Helvetica',
    color: '#0f172a',
    lineHeight: 1.4,
  },
  header: {
    fontSize: 20,
    fontWeight: 700,
    marginBottom: 6,
  },
  subheader: {
    fontSize: 12,
    marginBottom: 16,
    color: '#475569',
  },
  section: {
    marginBottom: 18,
  },
  sectionTitle: {
    fontSize: 14,
    marginBottom: 6,
    color: '#020617',
  },
  paragraph: {
    marginBottom: 6,
  },
  listItem: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  bullet: {
    width: 10,
  },
  listText: {
    flex: 1,
  },
  divider: {
    marginVertical: 12,
    borderBottomColor: '#cbd5f5',
    borderBottomWidth: 1,
  },
  footer: {
    marginTop: 12,
    fontSize: 10,
    color: '#64748b',
  },
})

const GuideDocument = () => {
  const generatedAt = new Intl.DateTimeFormat('es-PE', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date())

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.header}>Guía operativa del panel SYST</Text>
        <Text style={styles.subheader}>
          Actualizado: {generatedAt} · Este documento resume cómo usar cada módulo para activar tus canales.
        </Text>

        {panelSections.map((section) => (
          <View key={section.title} style={styles.section}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            <Text style={styles.paragraph}>{section.description}</Text>
            {section.steps.map((step, index) => (
              <View key={`${section.title}-${index}`} style={styles.listItem}>
                <Text style={styles.bullet}>•</Text>
                <Text style={styles.listText}>{step}</Text>
              </View>
            ))}
          </View>
        ))}

        <View style={styles.divider} />

        <Text style={styles.sectionTitle}>Detalle por canal</Text>
        {channelDeepDive.map((channel) => (
          <View key={channel.name} style={{ marginBottom: 10 }}>
            <Text style={{ fontSize: 12, fontWeight: 700 }}>{channel.name}</Text>
            {channel.usage.map((step, index) => (
              <View key={`${channel.name}-${index}`} style={styles.listItem}>
                <Text style={styles.bullet}>◦</Text>
                <Text style={styles.listText}>{step}</Text>
              </View>
            ))}
          </View>
        ))}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Soporte y QA</Text>
          {supportInfo.map((line) => (
            <View key={line} style={styles.listItem}>
              <Text style={styles.bullet}>•</Text>
              <Text style={styles.listText}>{line}</Text>
            </View>
          ))}
        </View>

        <Text style={styles.footer}>
          SYST · botsas.com · Comparte este PDF con tu equipo para asegurar una configuración consistente.
        </Text>
      </Page>
    </Document>
  )
}

export async function GET() {
  const pdfInstance = pdf(<GuideDocument />)
  const pdfBlob = await pdfInstance.toBlob()
  const arrayBuffer = await pdfBlob.arrayBuffer()

  return new NextResponse(arrayBuffer, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'attachment; filename="syst-centro-ayuda.pdf"',
    },
  })
}
