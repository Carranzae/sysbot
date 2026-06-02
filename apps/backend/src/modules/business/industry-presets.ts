import { IndustryType } from './dto/business.dto';

interface IndustryPreset {
  defaultCategories: string[];
  welcomeTemplate: string;
  fallbackTemplate: string;
  promptTemplate: string;
}

export const DEFAULT_INDUSTRY_PRESET: IndustryPreset = {
  defaultCategories: ['Consultas', 'Información general', 'Soporte'],
  welcomeTemplate:
    '¡Hola! 👋 Bienvenido a {businessName}. Estamos listos para ayudarte con cualquier consulta.',
  fallbackTemplate:
    'Gracias por contactar a {businessName}. En este momento no estamos disponibles, te responderemos lo antes posible.',
  promptTemplate:
    'Actúa como asistente especializado de {businessName}. Da respuestas cordiales, claras y concisas. Ofrece agendar una cita o tomar datos si el usuario necesita seguimiento humano.',
};

export const INDUSTRY_PRESETS: Record<IndustryType, IndustryPreset> = {
  [IndustryType.RESTAURANT]: {
    defaultCategories: ['Reservas', 'Menú', 'Delivery', 'Promociones', 'Eventos'],
    welcomeTemplate:
      '🍽️ Bienvenido a {businessName}. Podemos ayudarte con reservas, pedidos y recomendaciones del menú.',
    fallbackTemplate:
      'Gracias por contactar a {businessName}. Nuestros anfitriones te responderán en cuanto abran la cocina.',
    promptTemplate:
      'Eres el asistente de un restaurante llamado {businessName}. Habla con tono cálido y gastronómico. Prioriza temas como reservas, menús, tiempos de entrega y eventos especiales. Ofrece opciones concretas y confirma información de contacto para asegurar la reserva.',
  },
  [IndustryType.CLINIC]: {
    defaultCategories: ['Citas médicas', 'Especialidades', 'Resultados', 'Seguros', 'Atención al paciente'],
    welcomeTemplate:
      '🏥 Bienvenido a {businessName}. Agenda tu cita o resuelve dudas sobre nuestros servicios médicos.',
    fallbackTemplate:
      'Gracias por escribir a {businessName}. Nuestro equipo médico te responderá en breve.',
    promptTemplate:
      'Eres asistente de una clínica {businessName}. Usa un tono profesional y empático. Prioriza agendamiento de citas, tipos de especialidades, horarios y requisitos. Solicita datos básicos (nombre, motivo, teléfono) para coordinar con el personal de salud.',
  },
  [IndustryType.REAL_ESTATE]: {
    defaultCategories: ['Propiedades en venta', 'Propiedades en alquiler', 'Visitas', 'Financiamiento', 'Documentación'],
    welcomeTemplate:
      '🏢 Bienvenido a {businessName}. Te ayudamos a encontrar la propiedad ideal o agendar visitas personalizadas.',
    fallbackTemplate:
      'Gracias por contactar a {businessName}. Un asesor inmobiliario te responderá pronto.',
    promptTemplate:
      'Eres asistente inmobiliario de {businessName}. Habla de inmuebles, ubicaciones y presupuestos. Propón agendar visitas y recopila preferencias (zona, tipo de propiedad, rango de precio). Ofrece coordinar con un agente humano cuando sea necesario.',
  },
  [IndustryType.ACADEMY]: {
    defaultCategories: ['Cursos', 'Inscripciones', 'Horarios', 'Pagos', 'Certificaciones'],
    welcomeTemplate:
      '🎓 Bienvenido a {businessName}. Podemos orientarte sobre cursos, horarios y procesos de inscripción.',
    fallbackTemplate:
      'Gracias por escribir a {businessName}. Un asesor académico te responderá pronto.',
    promptTemplate:
      'Eres asistente académico de {businessName}. Usa un tono motivador y claro. Prioriza información de cursos, niveles, requisitos y pagos. Invita a registrarse o agendar una sesión informativa. Registra datos de contacto para seguimiento.',
  },
  [IndustryType.RETAIL]: {
    defaultCategories: ['Productos', 'Pedidos', 'Promociones', 'Envíos', 'Garantías'],
    welcomeTemplate:
      '🛍️ Bienvenido a {businessName}. Consulta sobre productos, stock, promociones y envíos.',
    fallbackTemplate:
      'Gracias por contactar a {businessName}. Te responderemos apenas volvamos al chat.',
    promptTemplate:
      'Eres asistente comercial de {businessName}. Enfócate en disponibilidad de productos, precios, promociones y logística de entrega. Ofrece alternativas si algo no está en stock y captura los datos para cerrar ventas.',
  },
  [IndustryType.SERVICES]: {
    defaultCategories: ['Servicios', 'Cotizaciones', 'Soporte', 'Agendamientos', 'Facturación'],
    welcomeTemplate:
      '⚙️ Bienvenido a {businessName}. Coordinemos el servicio que necesitas o resolvamos tus dudas técnicas.',
    fallbackTemplate:
      'Gracias por escribir a {businessName}. Un especialista se pondrá en contacto muy pronto.',
    promptTemplate:
      'Eres asistente de servicios profesionales para {businessName}. Obtén el tipo de servicio requerido, urgencia y datos del cliente. Ofrece cotizar o agendar una llamada según corresponda.',
  },
  [IndustryType.OTHER]: DEFAULT_INDUSTRY_PRESET,
};
