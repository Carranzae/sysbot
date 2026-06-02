import { Injectable, Logger } from '@nestjs/common';

export type CustomerProfileType = 'JOVEN' | 'MUJER_ADULTA' | 'VARON_ADULTO' | 'ADULTO_MAYOR';

@Injectable()
export class PeruvianToneService {
  private readonly logger = new Logger(PeruvianToneService.name);

  /**
   * Clasifica de manera predictiva el perfil del cliente basándose en el nombre,
   * vocabulario entrante y metadatos registrados.
   */
  detectCustomerProfile(
    messageContent: string,
    contactMetadata?: { name?: string; gender?: string; age?: number }
  ): CustomerProfileType {
    const text = messageContent.toLowerCase();

    // 1. Detección por edad en metadatos
    if (contactMetadata?.age) {
      if (contactMetadata.age >= 65) return 'ADULTO_MAYOR';
      if (contactMetadata.age < 30) return 'JOVEN';
      if (contactMetadata.gender === 'FEMALE') return 'MUJER_ADULTA';
      if (contactMetadata.gender === 'MALE') return 'VARON_ADULTO';
    }

    // 2. Detección predictiva por vocabulario peruano
    if (text.includes('don ') || text.includes('doña ') || text.includes('jubilado') || text.includes('mayor')) {
      return 'ADULTO_MAYOR';
    }
    if (text.includes('causa') || text.includes('bro') || text.includes('mano') || text.includes('ya te yapeé') || text.includes('pila')) {
      return 'JOVEN';
    }

    // 3. Fallback basado en género si es mujer adulta o varón adulto
    if (contactMetadata?.gender === 'FEMALE') {
      return 'MUJER_ADULTA';
    }
    if (contactMetadata?.gender === 'MALE') {
      return 'VARON_ADULTO';
    }

    // Default balanceado
    return 'VARON_ADULTO';
  }

  /**
   * Modula la respuesta generada por los RAGs / LLMs para ajustarse al estilo Formal-Casual peruano exacto de cada perfil.
   */
  modulateResponse(
    baseResponse: string,
    profile: CustomerProfileType,
    clientName?: string
  ): string {
    const nameStr = clientName ? ` ${clientName}` : '';
    let modulated = baseResponse;

    // Remover frases "frías" o extremadamente informales mediante filtros estrictos de "Lo que se EVITA"
    modulated = this.applySlangFilter(modulated);

    switch (profile) {
      case 'JOVEN':
        this.logger.log('[Peruvian Tone] Modulando respuesta para perfil JOVEN');
        // Tono dinámico, directo, de "tú" cordial. Explicación práctica y guerrera.
        if (modulated.includes('Buenas tardes') || modulated.includes('Estimado')) {
          modulated = modulated.replace(/buenas tardes/gi, 'Hola, ¿qué tal?');
        }
        // Inyectar gancho amigable de cierre
        if (modulated.includes('adquirir') || modulated.includes('comprar')) {
          modulated = modulated.replace(/¿Desea adquirir este producto\?/gi, '¿Te parece si te separo uno antes de que vuele el stock?');
        }
        modulated = modulated.replace(/\busted\b/gi, 'tú');
        modulated = modulated.replace(/\ble explico\b/gi, 'mira, te explico');
        break;

      case 'MUJER_ADULTA':
        this.logger.log('[Peruvian Tone] Modulando respuesta para perfil MUJER ADULTA');
        // Tono empático, de "Usted", llamando Señora. Enfoque en calidad e inversión inteligente.
        const saludoMujer = `Buenas tardes Sra.${nameStr}, ¿cómo está? Qué gusto.`;
        if (modulated.includes('Hola') || modulated.includes('Estimada')) {
          modulated = modulated.replace(/hola/gi, saludoMujer);
        }
        // Técnica del Gancho Empático en objeciones de costo
        if (modulated.includes('cuesta') || modulated.includes('precio')) {
          modulated = `Entiendo perfectamente lo que busca Sra.${nameStr}, a veces una busca algo que de verdad dure y no nos haga dar doble gasto. ` + modulated;
        }
        break;

      case 'VARON_ADULTO':
        this.logger.log('[Peruvian Tone] Modulando respuesta para perfil VARÓN ADULTO');
        // Tono ejecutivo, directo, "Caballero", de "Usted". Enfoque en eficiencia y garantías.
        const saludoVaron = `Buenas tardes caballero${nameStr}, ¿qué tal?`;
        if (modulated.includes('Hola') || modulated.includes('Estimado')) {
          modulated = modulated.replace(/hola/gi, saludoVaron);
        }
        // Evitar explicaciones emocionales, inyectar "bueno, bonito y barato" con respaldo
        if (modulated.includes('es caro') || modulated.includes('elevado')) {
          modulated = modulated.replace(/el precio es elevado/gi, 'Es una excelente inversión que cumple con las tres B (bueno, bonito y barato), pero con total garantía y respaldo');
        }
        break;

      case 'ADULTO_MAYOR':
        this.logger.log('[Peruvian Tone] Modulando respuesta para perfil ADULTO MAYOR');
        // Tono pausado, afectuoso, aclarando procesos tecnológicos ("pasito a paso", "bien explicadito").
        const saludoMayor = `Muy buenas tardes, qué gusto saludarlo. Tome asiento o póngase cómodo por favor.`;
        modulated = saludoMayor + ' ' + modulated;
        modulated = modulated.replace(/tecnología/gi, 'sistema de manera fácil y segura');
        // Suavizar acciones
        modulated = modulated.replace(/complete el pago/gi, 'no se preocupe por el papeleo, yo mismo me encargo de dejarle todo listo y bien explicadito paso a paso');
        break;
    }

    return modulated;
  }

  /**
   * Filtro corrector de "SÍ vs EVITA" para purgar términos robóticos o vulgares
   */
  private applySlangFilter(text: string): string {
    let cleanText = text;

    // Filtros de Evitar
    cleanText = cleanText.replace(/\bcausa\b/gi, 'amigo');
    cleanText = cleanText.replace(/\bbatería\b/gi, 'coordinación');
    cleanText = cleanText.replace(/\bhermano\b/gi, 'caballero');
    cleanText = cleanText.replace(/\bEstimado usuario\b/gi, '¿Qué tal?, ¿cómo está?');
    cleanText = cleanText.replace(/\bProcederé a detallar los lineamientos técnicos\b/gi, 'Mire, le explico clarito');
    cleanText = cleanText.replace(/\btienes que comprar\b/gi, 'Le ofrezco esta alternativa');
    
    return cleanText;
  }
}
