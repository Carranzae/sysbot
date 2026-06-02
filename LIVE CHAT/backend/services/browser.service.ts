import { chromium } from 'playwright-extra'
import stealth from 'puppeteer-extra-plugin-stealth'
import { logger } from '../api/utils/logger'
import path from 'path'
import fs from 'fs'

// Activar plugin de invisibilidad (Stealth)
chromium.use(stealth())

/**
 * ═══════════════════════════════════════════════════════════════
 * BROWSER SERVICE — NAVEGADOR STEALTH DE NIVEL ÉLITE
 * ═══════════════════════════════════════════════════════════════
 * 
 * Funcionalidades:
 * 1. Navegador Stealth con plugin anti-detección (evade Cloudflare, etc.)
 * 2. Persistencia de sesiones autenticadas (cookies se guardan en disco)
 * 3. Reutilización de contextos por dominio para no hacer login repetido
 * 4. Simulación de comportamiento humano (retrasos, viewport, user-agent)
 */
export class BrowserService {
  private browser: any = null
  private readonly SESSION_DIR = path.join(process.cwd(), '.browser_sessions')

  /**
   * Lanza una instancia de navegador de élite con parámetros de invisibilidad.
   */
  private async getBrowser() {
    if (!this.browser) {
      this.browser = await chromium.launch({
        headless: true, // Cambiar a false para depuración visual
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-blink-features=AutomationControlled',
          '--use-gl=desktop'
        ]
      })
    }
    return this.browser
  }

  /**
   * Obtiene la ruta del archivo de sesión para un dominio específico.
   */
  private getSessionPath(domain: string): string {
    if (!fs.existsSync(this.SESSION_DIR)) {
      fs.mkdirSync(this.SESSION_DIR, { recursive: true })
    }
    return path.join(this.SESSION_DIR, `${domain.replace(/[^a-z0-9]/gi, '_')}.json`)
  }

  /**
   * Navega a una URL, realiza acciones y captura datos o imágenes.
   * Diseñado para actuar como humano.
   */
  async executeAgentAction(
    url: string,
    action: (page: any) => Promise<any>
  ): Promise<any> {
    const browser = await this.getBrowser()
    // Crear un contexto con un User-Agent de una persona real en Windows
    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      viewport: { width: 1280, height: 800 },
      deviceScaleFactor: 1,
    })

    const page = await context.newPage()
    
    try {
      logger.info(`[BROWSER-AGENT] Iniciando misión en: ${url}`)
      
      // Simular comportamiento humano: retrasos aleatorios
      await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 })
      await page.waitForTimeout(Math.random() * 2000 + 1000)

      const result = await action(page)
      
      return result
    } catch (error: any) {
      logger.error(`[BROWSER-AGENT] Fallo en la misión: ${error.message}`)
      // Tomar captura del error para diagnóstico por IA
      const errorPath = path.join(process.cwd(), 'uploads', 'debug', `error-${Date.now()}.png`)
      if (!fs.existsSync(path.dirname(errorPath))) fs.mkdirSync(path.dirname(errorPath), { recursive: true })
      await page.screenshot({ path: errorPath, fullPage: true }).catch(() => {})
      
      throw error
    } finally {
      await context.close()
    }
  }

  /**
   * Ejecuta una acción con sesión persistente.
   * Guarda cookies en disco para reutilizar sesiones autenticadas.
   * Ideal para Shalom Pro donde se requiere login.
   */
  async executeWithSession(
    url: string,
    sessionKey: string,
    action: (page: any, isAuthenticated: boolean) => Promise<any>
  ): Promise<any> {
    const browser = await this.getBrowser()
    const sessionPath = this.getSessionPath(sessionKey)

    // Cargar cookies guardadas si existen
    let storageState: any = undefined
    let isAuthenticated = false
    if (fs.existsSync(sessionPath)) {
      try {
        storageState = JSON.parse(fs.readFileSync(sessionPath, 'utf-8'))
        isAuthenticated = true
        logger.info(`[BROWSER-AGENT] Sesión guardada encontrada para: ${sessionKey}`)
      } catch {
        logger.warn(`[BROWSER-AGENT] Sesión corrupta para ${sessionKey}. Iniciando nueva.`)
      }
    }

    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      viewport: { width: 1280, height: 800 },
      deviceScaleFactor: 1,
      ...(storageState ? { storageState } : {})
    })

    const page = await context.newPage()

    try {
      logger.info(`[BROWSER-AGENT] Misión con sesión (${sessionKey}) en: ${url}`)

      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 })
      await page.waitForTimeout(Math.random() * 1500 + 500)

      const result = await action(page, isAuthenticated)

      // Guardar las cookies después de la acción (login exitoso, etc.)
      const newState = await context.storageState()
      fs.writeFileSync(sessionPath, JSON.stringify(newState, null, 2))
      logger.info(`[BROWSER-AGENT] Sesión guardada exitosamente para: ${sessionKey}`)

      return result
    } catch (error: any) {
      logger.error(`[BROWSER-AGENT] Fallo en misión con sesión (${sessionKey}): ${error.message}`)
      const errorPath = path.join(process.cwd(), 'uploads', 'debug', `error-${sessionKey}-${Date.now()}.png`)
      if (!fs.existsSync(path.dirname(errorPath))) fs.mkdirSync(path.dirname(errorPath), { recursive: true })
      await page.screenshot({ path: errorPath, fullPage: true }).catch(() => {})
      throw error
    } finally {
      await context.close()
    }
  }

  /**
   * Invalida (borra) la sesión guardada para un dominio.
   * Útil cuando el password cambió o la sesión expiró.
   */
  invalidateSession(sessionKey: string) {
    const sessionPath = this.getSessionPath(sessionKey)
    if (fs.existsSync(sessionPath)) {
      fs.unlinkSync(sessionPath)
      logger.info(`[BROWSER-AGENT] Sesión invalidada para: ${sessionKey}`)
    }
  }

  /**
   * Cierra el navegador por completo para liberar recursos.
   */
  async shutdown() {
    if (this.browser) {
      await this.browser.close()
      this.browser = null
    }
  }
}

export const browserService = new BrowserService()
