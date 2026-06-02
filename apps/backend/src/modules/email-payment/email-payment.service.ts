import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const Imap = require('imap');
import { simpleParser } from 'mailparser';

export interface PaymentEmailSearch {
  securityCode?: string;
  amount?: number;
  date?: Date;
  customerName?: string;
}

export interface PaymentEmailResult {
  found: boolean;
  email?: {
    subject: string;
    from: string;
    date: Date;
    body: string;
  };
}

@Injectable()
export class EmailPaymentService {
  private readonly logger = new Logger(EmailPaymentService.name);

  constructor(private configService: ConfigService) {}

  /**
   * Conecta a un servidor de correo usando IMAP
   */
  private async connectToEmail(
    email: string,
    password: string,
    provider: 'GMAIL' | 'OUTLOOK' | 'OTHER' = 'GMAIL',
  ): Promise<any> {
    return new Promise((resolve, reject) => {
      let imapConfig: any;

      switch (provider) {
        case 'GMAIL':
          imapConfig = {
            user: email,
            password: password,
            host: 'imap.gmail.com',
            port: 993,
            tls: true,
            tlsOptions: { rejectUnauthorized: false },
          };
          break;
        case 'OUTLOOK':
          imapConfig = {
            user: email,
            password: password,
            host: 'outlook.office365.com',
            port: 993,
            tls: true,
            tlsOptions: { rejectUnauthorized: false },
          };
          break;
        default:
          reject(new Error('Proveedor de correo no soportado'));
          return;
      }

      const imap = new Imap(imapConfig);

      imap.once('ready', () => {
        this.logger.log(`[EmailPayment] Conectado a ${provider}: ${email}`);
        resolve(imap);
      });

      imap.once('error', (err: Error) => {
        this.logger.error(`[EmailPayment] Error de conexión: ${err.message}`);
        reject(err);
      });

      imap.connect();
    });
  }

  /**
   * Busca pagos en el correo electrónico
   */
  async searchPayments(
    email: string,
    password: string,
    provider: 'GMAIL' | 'OUTLOOK' | 'OTHER',
    searchCriteria: PaymentEmailSearch,
  ): Promise<PaymentEmailResult> {
      let imap: any = null;

    try {
      this.logger.log(`[EmailPayment] Buscando pagos en correo: ${email}`);

      imap = await this.connectToEmail(email, password, provider);

      return new Promise((resolve, reject) => {
        imap!.openBox('INBOX', false, (err, box) => {
          if (err) {
            this.logger.error(`[EmailPayment] Error al abrir buzón: ${err.message}`);
            reject(err);
            return;
          }

          // Buscar correos de las últimas 24 horas
          const yesterday = new Date();
          yesterday.setDate(yesterday.getDate() - 1);

          const searchCriteria_imap: any[] = ['SINCE', yesterday];

          // Si hay código de seguridad, buscar en asunto y cuerpo
          if (searchCriteria.securityCode) {
            searchCriteria_imap.push(['OR', ['SUBJECT', searchCriteria.securityCode], ['BODY', searchCriteria.securityCode]]);
          }

          imap!.search(searchCriteria_imap, (err, results) => {
            if (err) {
              this.logger.error(`[EmailPayment] Error en búsqueda: ${err.message}`);
              reject(err);
              return;
            }

            if (!results || results.length === 0) {
              this.logger.log(`[EmailPayment] No se encontraron correos`);
              resolve({ found: false });
              return;
            }

            this.logger.log(`[EmailPayment] Encontrados ${results.length} correos, procesando...`);

            const fetch = imap!.fetch(results, { bodies: '', struct: true });
            let foundMatch = false;

            fetch.on('message', (msg, seqno) => {
              msg.on('body', async (stream) => {
                try {
                  const parsed = await simpleParser(stream);

                  if (foundMatch) return; // Ya encontramos una coincidencia

                  const subject = parsed.subject || '';
                  const text = parsed.text || '';
                  const html = parsed.html || '';
                  const from = parsed.from?.text || '';
                  const date = parsed.date || new Date();

                  const fullText = `${subject} ${text} ${html}`.toLowerCase();

                  // Verificar coincidencias
                  let matches = true;

                  if (searchCriteria.securityCode) {
                    const codeInText = fullText.includes(searchCriteria.securityCode.toLowerCase());
                    if (!codeInText) {
                      matches = false;
                    }
                  }

                  if (searchCriteria.amount && matches) {
                    const amountStr = searchCriteria.amount.toFixed(2);
                    const amountInText = fullText.includes(amountStr) || fullText.includes(amountStr.replace('.', ','));
                    if (!amountInText) {
                      matches = false;
                    }
                  }

                  if (searchCriteria.customerName && matches) {
                    const nameInText = fullText.includes(searchCriteria.customerName.toLowerCase());
                    // El nombre es opcional, no falla si no está
                  }

                  if (matches) {
                    foundMatch = true;
                    this.logger.log(`[EmailPayment] ✅ Coincidencia encontrada en correo: ${subject}`);

                    resolve({
                      found: true,
                      email: {
                        subject,
                        from,
                        date,
                        body: text || html,
                      },
                    });

                    imap!.end();
                  }
                } catch (err: any) {
                  this.logger.error(`[EmailPayment] Error al parsear correo: ${err.message}`);
                }
              });
            });

            fetch.once('end', () => {
              if (!foundMatch) {
                this.logger.log(`[EmailPayment] No se encontraron coincidencias`);
                resolve({ found: false });
              }
              imap!.end();
            });

            fetch.once('error', (err) => {
              this.logger.error(`[EmailPayment] Error en fetch: ${err.message}`);
              reject(err);
            });
          });
        });
      });
    } catch (error) {
      this.logger.error(`[EmailPayment] Error al buscar pagos: ${error.message}`, error.stack);
      throw error;
    } finally {
      if (imap) {
        imap.end();
      }
    }
  }

  /**
   * Verifica un código de seguridad en el correo
   */
  async verifyPaymentCode(
    email: string,
    password: string,
    provider: 'GMAIL' | 'OUTLOOK' | 'OTHER',
    securityCode: string,
    amount: number,
    customerName?: string,
  ): Promise<boolean> {
    try {
      this.logger.log(`[EmailPayment] Verificando código: ${securityCode}, monto: ${amount}`);

      const result = await this.searchPayments(email, password, provider, {
        securityCode,
        amount,
        customerName,
      });

      return result.found;
    } catch (error) {
      this.logger.error(`[EmailPayment] Error al verificar código: ${error.message}`, error.stack);
      return false;
    }
  }
}

