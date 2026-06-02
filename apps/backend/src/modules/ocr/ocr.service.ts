import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as Tesseract from 'tesseract.js';

export interface OCRResult {
  text: string;
  amount?: number;
  date?: Date;
  securityCode?: string;
  operationNumber?: string;
  confidence: number;
}

@Injectable()
export class OCRService {
  private readonly logger = new Logger(OCRService.name);

  constructor(private configService: ConfigService) {}

  /**
   * Extrae texto de una imagen usando OCR
   */
  async extractTextFromImage(imagePath: string): Promise<string> {
    try {
      this.logger.log(`[OCR] Procesando imagen: ${imagePath}`);
      
      const { data } = await Tesseract.recognize(imagePath, 'spa', {
        logger: (m) => {
          if (m.status === 'recognizing text') {
            this.logger.debug(`[OCR] Progreso: ${Math.round(m.progress * 100)}%`);
          }
        },
      });

      const extractedText = data.text.trim();
      this.logger.log(`[OCR] Texto extraído (${extractedText.length} caracteres)`);
      
      return extractedText;
    } catch (error) {
      this.logger.error(`[OCR] Error al procesar imagen: ${error.message}`, error.stack);
      throw new Error(`Error al extraer texto de la imagen: ${error.message}`);
    }
  }

  /**
   * Extrae el monto de un texto (comprobante de pago)
   */
  extractAmount(text: string): number | null {
    try {
      // Patrones comunes para montos en comprobantes peruanos
      const amountPatterns = [
        /S\/\s*(\d+[.,]\d{2})/gi, // S/ 150.00 o S/ 150,00
        /S\/\.\s*(\d+[.,]\d{2})/gi, // S/. 150.00
        /(\d+[.,]\d{2})\s*S\/?/gi, // 150.00 S/
        /Monto[:\s]+S\/\s*(\d+[.,]\d{2})/gi, // Monto: S/ 150.00
        /Total[:\s]+S\/\s*(\d+[.,]\d{2})/gi, // Total: S/ 150.00
        /Importe[:\s]+S\/\s*(\d+[.,]\d{2})/gi, // Importe: S/ 150.00
        /(\d+[.,]\d{2})/g, // Cualquier número con decimales (último recurso)
      ];

      const amounts: number[] = [];

      for (const pattern of amountPatterns) {
        const matches = text.matchAll(pattern);
        for (const match of matches) {
          const amountStr = match[1] || match[0];
          const amount = parseFloat(amountStr.replace(',', '.'));
          if (!isNaN(amount) && amount > 0 && amount < 1000000) {
            amounts.push(amount);
          }
        }
      }

      if (amounts.length === 0) {
        this.logger.warn(`[OCR] No se encontró monto en el texto`);
        return null;
      }

      // Tomar el monto más grande (generalmente es el total)
      const maxAmount = Math.max(...amounts);
      this.logger.log(`[OCR] Monto extraído: S/ ${maxAmount}`);
      return maxAmount;
    } catch (error) {
      this.logger.error(`[OCR] Error al extraer monto: ${error.message}`);
      return null;
    }
  }

  /**
   * Extrae la fecha de un texto
   */
  extractDate(text: string): Date | null {
    try {
      // Patrones comunes para fechas
      const datePatterns = [
        /(\d{2})\/(\d{2})\/(\d{4})/g, // DD/MM/YYYY
        /(\d{2})-(\d{2})-(\d{4})/g, // DD-MM-YYYY
        /(\d{4})-(\d{2})-(\d{2})/g, // YYYY-MM-DD
        /(\d{2})\/(\d{2})\/(\d{2})/g, // DD/MM/YY
      ];

      for (const pattern of datePatterns) {
        const matches = text.matchAll(pattern);
        for (const match of matches) {
          let day: number, month: number, year: number;

          if (match[0].includes('-') && match[1].length === 4) {
            // YYYY-MM-DD
            year = parseInt(match[1]);
            month = parseInt(match[2]) - 1;
            day = parseInt(match[3]);
          } else {
            // DD/MM/YYYY o DD-MM-YYYY
            day = parseInt(match[1]);
            month = parseInt(match[2]) - 1;
            year = parseInt(match[3]);
            if (year < 100) {
              year += 2000; // Asumir años 2000+
            }
          }

          const date = new Date(year, month, day);
          if (!isNaN(date.getTime()) && date <= new Date() && date >= new Date('2020-01-01')) {
            this.logger.log(`[OCR] Fecha extraída: ${date.toISOString()}`);
            return date;
          }
        }
      }

      this.logger.warn(`[OCR] No se encontró fecha válida en el texto`);
      return null;
    } catch (error) {
      this.logger.error(`[OCR] Error al extraer fecha: ${error.message}`);
      return null;
    }
  }

  /**
   * Extrae el código de seguridad (Yape/Plin)
   */
  extractSecurityCode(text: string): string | null {
    try {
      // Patrones comunes para códigos de seguridad
      const codePatterns = [
        /Código[:\s]+(\d{6})/gi, // Código: 123456
        /Cód[:\s]+(\d{6})/gi, // Cód: 123456
        /Código de seguridad[:\s]+(\d{6})/gi,
        /Código de verificación[:\s]+(\d{6})/gi,
        /(\d{6})/g, // Cualquier secuencia de 6 dígitos (último recurso)
      ];

      const codes: string[] = [];

      for (const pattern of codePatterns) {
        const matches = text.matchAll(pattern);
        for (const match of matches) {
          const code = match[1] || match[0];
          if (code.length === 6 && /^\d{6}$/.test(code)) {
            codes.push(code);
          }
        }
      }

      if (codes.length === 0) {
        this.logger.warn(`[OCR] No se encontró código de seguridad`);
        return null;
      }

      // Tomar el primer código encontrado
      const securityCode = codes[0];
      this.logger.log(`[OCR] Código de seguridad extraído: ${securityCode}`);
      return securityCode;
    } catch (error) {
      this.logger.error(`[OCR] Error al extraer código de seguridad: ${error.message}`);
      return null;
    }
  }

  /**
   * Extrae el número de operación
   */
  extractOperationNumber(text: string): string | null {
    try {
      const operationPatterns = [
        /Operación[:\s]+(\d+)/gi, // Operación: 789012
        /N°\s*Op[:\s]+(\d+)/gi, // N° Op: 789012
        /Número de operación[:\s]+(\d+)/gi,
        /Op[:\s]+(\d+)/gi, // Op: 789012
      ];

      for (const pattern of operationPatterns) {
        const match = text.match(pattern);
        if (match && match[1]) {
          this.logger.log(`[OCR] Número de operación extraído: ${match[1]}`);
          return match[1];
        }
      }

      return null;
    } catch (error) {
      this.logger.error(`[OCR] Error al extraer número de operación: ${error.message}`);
      return null;
    }
  }

  /**
   * Procesa una imagen de comprobante y extrae toda la información
   */
  async processReceipt(imagePath: string): Promise<OCRResult> {
    try {
      this.logger.log(`[OCR] Procesando comprobante: ${imagePath}`);

      // Extraer texto
      const text = await this.extractTextFromImage(imagePath);

      // Extraer información específica
      const amount = this.extractAmount(text);
      const date = this.extractDate(text);
      const securityCode = this.extractSecurityCode(text);
      const operationNumber = this.extractOperationNumber(text);

      const result: OCRResult = {
        text,
        amount: amount || undefined,
        date: date || undefined,
        securityCode: securityCode || undefined,
        operationNumber: operationNumber || undefined,
        confidence: amount ? 0.8 : 0.5, // Confianza basada en si se encontró monto
      };

      this.logger.log(`[OCR] Resultado del procesamiento:`, {
        hasAmount: !!amount,
        hasDate: !!date,
        hasSecurityCode: !!securityCode,
        hasOperationNumber: !!operationNumber,
      });

      return result;
    } catch (error) {
      this.logger.error(`[OCR] Error al procesar comprobante: ${error.message}`, error.stack);
      throw error;
    }
  }
}










