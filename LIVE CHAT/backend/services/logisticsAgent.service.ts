import { browserService } from './browser.service'
import { logger } from '../api/utils/logger'
import { settingsService } from '../src/domains/settings/service'
import path from 'path'
import fs from 'fs'

/**
 * ═══════════════════════════════════════════════════════════════
 * LOGISTICS AGENT SERVICE — RASTREO ÉLITE (SIN IA, COSTO CERO)
 * ═══════════════════════════════════════════════════════════════
 *
 * Shalom: Login con email/contraseña → sesión persistente → extracción DOM.
 * Olva:   Navegador Stealth (anti-detección) → extracción DOM.
 *
 * NO se usa Gemini Vision para rastreo. Costo de IA = $0.
 * Si un método falla, se devuelve un mensaje claro en lugar de
 * desperdiciar tokens de IA en algo que probablemente sea un
 * error temporal de red o un cambio de diseño en el sitio.
 */
export class LogisticsAgentService {

  /**
   * SHALOM — Rastreo con Login Directo (Sesión Persistente)
   * ────────────────────────────────────────────────────────
   * 1. Lee las credenciales del .env.
   * 2. Si hay sesión guardada, la reutiliza (sin volver a loguearse).
   * 3. Si la sesión expiró, la invalida y hace login de nuevo.
   * 4. Extrae el estado del paquete leyendo el texto del DOM.
   * 5. Si todo falla, devuelve un error claro (NO usa IA).
   */
  async trackShalom(guideNumber: string, orderCode?: string): Promise<{ status: string; detail: string; screenshot?: string }> {
    let emails = (process.env.SHALOM_EMAIL || '').split(',').map(e => e.trim()).filter(Boolean)
    let passwords = (process.env.SHALOM_PASSWORD || '').split(',').map(p => p.trim()).filter(Boolean)

    try {
      const dbCreds = await settingsService.getSystemCredentials()
      if (dbCreds.shalomEmail && dbCreds.shalomPassword) {
        emails = dbCreds.shalomEmail.split(',').map((e: string) => e.trim()).filter(Boolean)
        passwords = dbCreds.shalomPassword.split(',').map((p: string) => p.trim()).filter(Boolean)
      }
    } catch (dbError: any) {
      logger.error(`[AGENT-SHALOM] Error reading credentials from DB, falling back to environment variables: ${dbError.message}`)
    }

    if (emails.length === 0 || passwords.length === 0) {
      logger.warn(`[AGENT-SHALOM] Credenciales no configuradas en la base de datos ni en .env. No se puede rastrear.`)
      return {
        status: 'Sin Configurar',
        detail: 'Las credenciales de Shalom (shalomEmail / shalomPassword) no están configuradas en el panel de administración ni en el servidor.'
      }
    }

    // ── ROTACIÓN DE CUENTAS (POOL) ──
    // Elegimos una cuenta al azar para evitar bloqueos por sobreuso de un solo usuario
    const randomIndex = Math.floor(Math.random() * emails.length)
    const email = emails[randomIndex]
    const password = passwords[randomIndex] || passwords[0] // Si hay menos passwords, usa el primero por defecto

    // La sesión guardada en disco ahora es ÚNICA por correo, así no se pisan las cookies
    const sessionKey = `shalom-pro-${email.replace(/[^a-z0-9]/gi, '_')}`

    try {
      logger.info(`[AGENT-SHALOM] Iniciando rastreo ÉLITE (Login) para guía: ${guideNumber} (Cuenta: ${email})`)

      const result = await browserService.executeWithSession(
        'https://pro.shalom.pe/',
        sessionKey,
        async (page, isAuthenticated) => {

          // ── PASO 1: LOGIN (solo si no hay sesión guardada) ──────────
          if (!isAuthenticated) {
            logger.info(`[AGENT-SHALOM] Sin sesión guardada. Ejecutando login...`)

            const loginSelectors = [
              'input[type="email"]', 'input[name="email"]',
              'input[name="username"]', 'input[name="usuario"]',
              'input[name="user"]', 'input[type="text"]'
            ]
            let loginInput: string | null = null
            for (const sel of loginSelectors) {
              if (await page.$(sel)) { loginInput = sel; break }
            }

            if (!loginInput) throw new Error('No se encontró campo de login en Shalom Pro')

            await page.fill(loginInput, email)
            await page.fill('input[type="password"], input[name="password"], input[name="clave"]', password)

            await Promise.all([
              page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 20000 }).catch(() => {}),
              page.click('button[type="submit"], input[type="submit"], button:has-text("Ingresar"), button:has-text("Iniciar")')
            ])

            await page.waitForTimeout(2000)
            const bodyAfterLogin = await page.evaluate(() => document.body.innerText)
            const currentUrl = page.url()
            
            if (bodyAfterLogin.match(/contraseña incorrecta|credenciales inválidas|error.*login|datos incorrectos/i) || 
                currentUrl.includes('login') || 
                bodyAfterLogin.match(/iniciar sesión|ingresar al sistema/i)) {
              browserService.invalidateSession(sessionKey)
              throw new Error('Login rechazado: Credenciales inválidas. Verifica tu correo y contraseña en el Panel de Administración.')
            }

            logger.info(`[AGENT-SHALOM] ✅ Login exitoso. Sesión guardada.`)

          } else {
            // ── Verificar que la sesión no haya expirado ──────────────
            logger.info(`[AGENT-SHALOM] ♻️ Sesión reutilizada. Verificando validez...`)
            const bodyText = await page.evaluate(() => document.body.innerText)
            if (bodyText.match(/iniciar sesión|login|ingresar/i) && !bodyText.match(/bienvenido|panel|dashboard/i)) {
              logger.warn(`[AGENT-SHALOM] Sesión expirada. Invalidando...`)
              browserService.invalidateSession(sessionKey)
              throw new Error('Sesión expirada — se reintentará con login fresco en el próximo ciclo')
            }
          }

          // ── PASO 2: BUSCAR LA GUÍA ────────────────────────────────────
          const searchSelectors = [
            'input[type="search"]', 'input[placeholder*="guía"]',
            'input[placeholder*="buscar"]', 'input[placeholder*="rastrear"]',
            'input[name="search"]', 'input[name="guia"]'
          ]
          let searchInput: string | null = null
          for (const sel of searchSelectors) {
            if (await page.$(sel)) { searchInput = sel; break }
          }

          if (!searchInput) {
            logger.warn(`[AGENT-SHALOM] Sin buscador en el panel. Usando URL directa de rastreo...`)
            await page.goto(`https://rastrea.shalom.pe/?guia=${guideNumber}`, { waitUntil: 'domcontentloaded', timeout: 35000 })
            await page.waitForTimeout(2000)

            // ── rastrea.shalom.pe es un DOMINIO DIFERENTE, necesita su propio login ──
            const rastreoBody = await page.evaluate(() => document.body.innerText)
            const rastreoUrl = page.url()

            if (rastreoBody.match(/iniciar sesión|inicia sesión|correo|contraseña/i) || rastreoUrl.includes('login')) {
              logger.info(`[AGENT-SHALOM] 🔑 rastrea.shalom.pe requiere login. Iniciando sesión...`)

              // Buscar los campos de login en esta página
              const rastreoLoginSelectors = [
                'input[type="email"]', 'input[name="email"]',
                'input[name="username"]', 'input[name="usuario"]',
                'input[name="user"]', 'input[type="text"]'
              ]
              let rastreoLoginInput: string | null = null
              for (const sel of rastreoLoginSelectors) {
                if (await page.$(sel)) { rastreoLoginInput = sel; break }
              }

              if (rastreoLoginInput) {
                await page.fill(rastreoLoginInput, email)
                await page.fill('input[type="password"], input[name="password"], input[name="clave"]', password)

                await Promise.all([
                  page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 20000 }).catch(() => {}),
                  page.click('button[type="submit"], input[type="submit"], button:has-text("Ingresar"), button:has-text("Iniciar")')
                ])

                await page.waitForTimeout(3000)
                logger.info(`[AGENT-SHALOM] ✅ Login en rastrea.shalom.pe completado.`)

                // Después del login, navegar de nuevo a la URL de rastreo con la guía
                const currentUrlAfterLogin = page.url()
                if (!currentUrlAfterLogin.includes(guideNumber)) {
                  await page.goto(`https://rastrea.shalom.pe/?guia=${guideNumber}`, { waitUntil: 'domcontentloaded', timeout: 35000 })
                  await page.waitForTimeout(3000)
                }
              } else {
                logger.warn(`[AGENT-SHALOM] No se encontró campo de login en rastrea.shalom.pe`)
              }
            }
          } else {
            await page.fill(searchInput, guideNumber)
            await page.keyboard.press('Enter')
          }

          // Llenar formulario de N° de Orden y Código de Orden en rastrea.shalom.pe si existe
          const orderInputSelector = 'input[placeholder*="N° de Orden"], input[placeholder*="Orden"]'
          const codeInputSelector = 'input[placeholder*="Código de Orden"], input[placeholder*="Código"]'

          if (await page.$(orderInputSelector) && await page.$(codeInputSelector)) {
            logger.info(`[AGENT-SHALOM] Formulario de Orden y Código encontrado. Llenando datos...`)

            let orderPart = guideNumber
            let codePart = orderCode || ''

            if (!codePart) {
              // Limpiar términos comunes que pueda ingresar el usuario
              const cleanGuide = guideNumber
                .replace(/(?:n[o°\.\s]*)?orden|c[oó]digo|cod|n[o°\.\s]*|\:/gi, ' ')
                .trim()
                .replace(/\s+/g, ' ')

              // 1. Intentar separar con espacios, guiones, barras, comas o puntos
              // Ej: "9560819 - C7P9", "9560819, C7P9", "9560819/C7P9"
              const sepMatch = cleanGuide.match(/^(\d{6,9})[\s\-\/\_,\.\:]+(\w{4})$/i)
              if (sepMatch) {
                orderPart = sepMatch[1]
                codePart = sepMatch[2]
                logger.info(`[AGENT-SHALOM] Guía separada con éxito (separador): Orden: "${orderPart}", Código: "${codePart}"`)
              } else {
                // 2. Intentar separar formatos pegados de 10 a 13 caracteres (números + 4 de código)
                // Ej: "9560819C7P9"
                const pegMatch = cleanGuide.match(/^(\d{6,9})(\w{4})$/i)
                if (pegMatch) {
                  orderPart = pegMatch[1]
                  codePart = pegMatch[2]
                  logger.info(`[AGENT-SHALOM] Guía separada con éxito (pegada): Orden: "${orderPart}", Código: "${codePart}"`)
                } else {
                  // Fallback final inteligente por corte
                  logger.warn(`[AGENT-SHALOM] Guía no tiene formato estándar de Shalom. Aplicando fallback de corte...`)
                  if (cleanGuide.length > 6) {
                    orderPart = cleanGuide.slice(0, cleanGuide.length - 4)
                    codePart = cleanGuide.slice(cleanGuide.length - 4)
                  } else {
                    codePart = 'TEST'
                  }
                }
              }
            } else {
               logger.info(`[AGENT-SHALOM] Usando N° de Orden: "${orderPart}" y Código de Orden explícito: "${codePart}"`)
            }

            await page.fill(orderInputSelector, orderPart)
            await page.fill(codeInputSelector, codePart)

            logger.info(`[AGENT-SHALOM] Haciendo clic en "Buscar" y esperando red...`)
            
            // Interceptar la petición AJAX que hace la plataforma al buscar
            const [response] = await Promise.all([
              page.waitForResponse((res: any) => ['fetch', 'xhr'].includes(res.request().resourceType()), { timeout: 15000 }).catch(() => null),
              page.click('button:has-text("Buscar"), button[type="submit"], input[type="submit"], .btn-search, #btnBuscar')
            ])
            
            if (response) {
              logger.info(`[AGENT-SHALOM] Respuesta AJAX recibida (${response.status()}). Esperando renderizado del DOM...`)
              await page.waitForTimeout(1500)
            } else {
              logger.warn(`[AGENT-SHALOM] Timeout de red. Procediendo a polling inteligente...`)
            }
          }

          // Espera inteligente por el resultado de Shalom (máximo 15 segundos adicionales)
            let loaded = false
            let resultText = ''
            for (let i = 0; i < 15; i++) {
              await page.waitForTimeout(1000)
              resultText = await page.evaluate(() => document.body.innerText)
              
              // Buscamos indicadores SEGUROS de que hay datos reales, no sólo placeholders
              // Se evitan palabras aisladas como "Remitente:" que siempre están en pantalla
              const hasStatus = resultText.match(/(entregado|recibido.*cliente|disponible.*agencia|listo.*recojo|en\s+agencia|en\s+ruta|en\s+viaje|transito|tránsito|recibido.*almacén|procesando)/i)
              const hasDate = resultText.match(/\d{2}\/\d{2}\/\d{4}/) // Suele aparecer la fecha de emisión o entrega
              const hasError = resultText.match(/(no\s+encontrad|no\s+existe|sin\s+resultado|incorrecto|inválido)/i)
              
              if (hasStatus || hasDate || hasError) {
                loaded = true
                logger.info(`[AGENT-SHALOM] Carga de resultado confirmada en el segundo ${i + 1}`)
                break
              }
            }

          // ── PASO 3: EXTRAER ESTADO DEL DOM ───────────────────────────
          let status = ''
          if      (resultText.match(/entregado|recibido.*cliente/i))              status = 'Entregado'
          else if (resultText.match(/disponible.*agencia|listo.*recojo|en\s+agencia/i)) status = 'Disponible en Agencia'
          else if (resultText.match(/en\s+ruta|en\s+viaje|transito|tránsito/i))   status = 'En Ruta'
          else if (resultText.match(/recibido.*almacén|procesando/i))              status = 'En Almacén'
          else if (resultText.match(/no encontr|no existe|sin resultado|incorrect/i))        status = 'No Encontrado'

          if (!status && loaded) {
            status = 'En Tránsito'
          }

          if (!status) {
            logger.warn(`[AGENT-SHALOM] La búsqueda de Shalom no cargó correctamente para la guía ${guideNumber}.`)
            return {
              status: 'Consulta Manual Requerida',
              detail: `La plataforma de Shalom está demorando en responder o los datos ingresados no son válidos. Te sugerimos realizar el rastreo directamente ingresando a rastrea.shalom.pe`
            }
          }

          logger.info(`[AGENT-SHALOM] Estado DOM extraído: "${status}"`)

          // ── PASO 4: CAPTURA DE PANTALLA CON MARCA DE ATINES ───────────
          // Inyectamos una marca de agua de ATINES antes de capturar
          await page.evaluate((statusText: string) => {
            const banner = document.createElement('div')
            banner.style.cssText = 'position: fixed; bottom: 20px; right: 20px; background: rgba(15, 23, 42, 0.95); color: white; padding: 15px 25px; border-radius: 12px; font-family: system-ui, -apple-system, sans-serif; z-index: 999999; box-shadow: 0 10px 25px rgba(0,0,0,0.5); border-left: 5px solid #3b82f6; backdrop-filter: blur(10px);'
            banner.innerHTML = `
              <div style="font-size: 12px; color: #94a3b8; margin-bottom: 4px; text-transform: uppercase; letter-spacing: 1px;">Verificado Oficialmente por</div>
              <div style="font-size: 24px; font-weight: 800; letter-spacing: 0.5px; margin-bottom: 8px;">ATINES<span style="color: #3b82f6;">.</span></div>
              <div style="font-size: 14px; border-top: 1px solid rgba(255,255,255,0.1); padding-top: 8px;">Estado actual: <strong style="color: #4ade80;">${statusText}</strong></div>
            `
            document.body.appendChild(banner)
          }, status)

          const screenshotName = `tracking-shalom-${guideNumber}-${Date.now()}.png`
          const screenshotPath = path.join(process.cwd(), 'uploads', 'tracking', screenshotName)
          if (!fs.existsSync(path.dirname(screenshotPath))) {
            fs.mkdirSync(path.dirname(screenshotPath), { recursive: true })
          }
          await page.screenshot({ path: screenshotPath, fullPage: true })

          return {
            status,
            detail: `Shalom Pro (${isAuthenticated ? 'Sesión Reutilizada' : 'Login Nuevo'})`,
            screenshot: `/uploads/tracking/${screenshotName}`
          }
        }
      );
      return result;
    } catch (error: any) {
      logger.error(`[AGENT-SHALOM] Error en rastreo: ${error.message}`)
      return {
        status: 'Error Temporal',
        detail: `No se pudo consultar Shalom: ${error.message}. Intenta de nuevo en unos minutos.`
      }
    }
  }

  /**
   * OLVA COURIER — Rastreo Stealth con Extracción DOM
   * ────────────────────────────────────────────────────
   * 1. Navegador invisible con plugin anti-detección (evade Cloudflare).
   * 2. Llena el formulario de seguimiento.
   * 3. Extrae el estado leyendo el HTML resultante.
   * 4. Si falla, devuelve un error claro (NO usa IA).
   */
  async trackOlva(guideNumber: string, year?: string): Promise<{ status: string; detail: string; screenshot?: string }> {
  try {
    return await browserService.executeAgentAction(
      'https://tracking.olvaexpress.pe/',
      async (page) => {
        logger.info(`[AGENT-OLVA] Rastreo Stealth DOM para guía: ${guideNumber} (Año: ${year || 'actual'})`);

        // Esperar el campo de número de tracking
        await page.waitForSelector('#trackingNumber', { timeout: 15000 });
        await page.fill('#trackingNumber', guideNumber);
        logger.info(`✅ Número de tracking rellenado: ${guideNumber}`);

                // Seleccionar año si el selector está presente (varios posibles)
        const yearSelector = 'select#emisionYear, select[name="emisionYear"], select[name="ano"], select[name="year"]';
        if (await page.$(yearSelector)) {
          try {
            const targetYear = year || new Date().getFullYear().toString();
            await page.selectOption(yearSelector, targetYear);
            logger.info(`✅ Año de emisión seleccionado: ${targetYear}`);
          } catch (e) {
            logger.warn(`⚠️ No se pudo seleccionar año con selector ${yearSelector}: ${e}`);
          }

        }


        // Click botón Enviar (varios selectores posibles)
        const btnSelectors = ['button:has-text("Enviar")', 'button[type="submit"]', 'input[type="submit"]'];
        let clicked = false;
        for (const sel of btnSelectors) {
          try {
            await page.click(sel, { timeout: 3000 });
            clicked = true;
            break;
          } catch { /* intentar siguiente */ }
        }
        if (!clicked) await page.keyboard.press('Enter');

        // Esperar resultados
        await page.waitForTimeout(5000);

        // Extraer texto de resultados
        const resultText = await page.evaluate(() => {
          const container = document.querySelector('.tracking-result, #resultado, .timeline, table, .result, #tracking');
          return container ? (container as HTMLElement).innerText : document.body.innerText;
        });

        let status = 'En Tránsito';
        if (resultText.match(/entregado/i)) status = 'Entregado';
        else if (resultText.match(/en tienda|agencia/i)) status = 'Disponible en Agencia';
        else if (resultText.match(/ruta|viaje|transito/i)) status = 'En Ruta';
        else if (resultText.match(/no encontrado|no existe/i)) status = 'No Encontrado';

        // Verificar que la respuesta no sea vacía
        if (resultText.length < 30) {
          throw new Error('Respuesta de Olva vacía — posible bloqueo de cookies o cambio de diseño');
        }

        logger.info(`[AGENT-OLVA] Estado DOM extraído: "${status}"`);

        // Inyección de marca de agua ATINES
        await page.evaluate((statusText: string) => {
          const banner = document.createElement('div');
          banner.style.cssText = 'position: fixed; bottom: 20px; right: 20px; background: rgba(15, 23, 42, 0.95); color: white; padding: 15px 25px; border-radius: 12px; font-family: system-ui, -apple-system, sans-serif; z-index: 999999; box-shadow: 0 10px 25px rgba(0,0,0,0.5); border-left: 5px solid #3b82f6; backdrop-filter: blur(10px);';
          banner.innerHTML = `
            <div style="font-size: 12px; color: #94a3b8; margin-bottom: 4px; text-transform: uppercase; letter-spacing: 1px;">Verificado Oficialmente por</div>
            <div style="font-size: 24px; font-weight: 800; letter-spacing: 0.5px; margin-bottom: 8px;">ATINES<span style="color: #3b82f6;">.</span></div>
            <div style="font-size: 14px; border-top: 1px solid rgba(255,255,255,0.1); padding-top: 8px;">Estado actual: <strong style="color: #4ade80;">${statusText}</strong></div>
          `;
          document.body.appendChild(banner);
        }, status);

        const screenshotName = `tracking-olva-${guideNumber}-${Date.now()}.png`;
        const screenshotPath = path.join(process.cwd(), 'uploads', 'tracking', screenshotName);
        if (!fs.existsSync(path.dirname(screenshotPath))) {
          fs.mkdirSync(path.dirname(screenshotPath), { recursive: true });
        }
        await page.screenshot({ path: screenshotPath, fullPage: true });

        return {
          status,
          detail: 'Olva Courier (Stealth DOM)',
          screenshot: `/uploads/tracking/${screenshotName}`
        };
      }
    );
  } catch (error: any) {
    logger.error(`[AGENT-OLVA] Error en rastreo Stealth: ${error.message}`);
    return {
      status: 'Error Temporal',
      detail: `No se pudo consultar Olva Courier: ${error.message}. El cliente puede rastrear manualmente en tracking.olvaexpress.pe.`
    };
  }
}
// Legacy Olva fallback method removed – kept only the trackingOlva implementation above  }
}

export const logisticsAgentService = new LogisticsAgentService()
