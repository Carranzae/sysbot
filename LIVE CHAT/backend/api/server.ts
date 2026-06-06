import 'dotenv/config'
// Trigger redeployment on Railway for sysbot (Live Chat backend)
import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import path from 'path'
import { fileURLToPath } from 'url'
import rateLimit from 'express-rate-limit'
import { createServer } from 'http'
import { Server } from 'socket.io'
import { config } from '../config/env.js'
import { logger } from './utils/logger.js'
import { requireAuth } from './middleware/auth.js'
import waRouter from '../src/domains/whatsapp/routes.js'
import { whatsappWebManager } from '../services/whatsappWeb.service.js'
import { db } from '../database/db.js'
import { syncUsersFromSysbot } from '../scripts/sync-users-auto.js'

const app = express()
const httpServer = createServer(app)

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// ─── CORS ──────────────────────────────────────────────────────────────────
const allowedOrigins = (config.server.frontendUrl || '')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean)

const corsOptions: cors.CorsOptions = {
  origin: (origin, callback) => {
    if (!origin) return callback(null, true)
    
    const cleanOrigin = origin.trim().replace(/\/$/, '')
    const allowedSet = new Set(allowedOrigins.map(o => o.trim().replace(/\/$/, '')))
    
    if (
      allowedOrigins.length === 0 ||
      allowedSet.has(cleanOrigin) ||
      cleanOrigin.endsWith('.vercel.app') ||
      cleanOrigin.includes('localhost') ||
      cleanOrigin.includes('127.0.0.1')
    ) {
      return callback(null, true)
    }
    
    logger.warn(`❌ [CORS] Origin rejected: ${origin}`)
    return callback(new Error(`Origin ${origin} not allowed by CORS`))
  },
  credentials: true,
}

// ─── SOCKET.IO ─────────────────────────────────────────────────────────────
const io = new Server(httpServer, { cors: corsOptions })

app.use((req: any, _res, next) => {
  req.io = io
  next()
})

// ─── SEGURIDAD ─────────────────────────────────────────────────────────────
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }))
app.use(cors(corsOptions))
app.use(express.json({ limit: '50mb' }))
app.use(express.urlencoded({ extended: true, limit: '50mb' }))

// Servir uploads (imágenes, QRs, etc.)
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')))

// Rate limit
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 2000,
  message: 'Demasiadas solicitudes.',
  skip: (req) => req.path === '/health',
})
app.use('/api/', limiter)

// ─── HEALTH CHECK ──────────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString(), service: 'lay-chat' })
})

// ─── AUTH MÍNIMA (login para obtener token) ─────────────────────────────────
app.post('/api/auth/login', async (req: any, res: any) => {
  try {
    const { email, password } = req.body
    if (!email || !password) return res.status(400).json({ error: 'Email y password requeridos' })

    const bcrypt = await import('bcryptjs')
    const jwt = await import('jsonwebtoken')

    const { rows } = await db.query('SELECT * FROM users WHERE email = $1 LIMIT 1', [email])
    if (!rows.length) return res.status(401).json({ error: 'Credenciales incorrectas' })

    const user = rows[0]
    const valid = await bcrypt.default.compare(password, user.password_hash || user.password)
    if (!valid) return res.status(401).json({ error: 'Credenciales incorrectas' })

    const token = jwt.default.sign(
      { id: user.id, role: user.role, email: user.email },
      config.auth.jwtSecret,
      { expiresIn: '7d' }
    )

    res.json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role, phone: user.phone } })
  } catch (e: any) {
    res.status(500).json({ error: e.message })
  }
})

app.get('/api/auth/me', requireAuth, async (req: any, res: any) => {
  try {
    const { rows } = await db.query('SELECT id, name, email, role, phone FROM users WHERE id = $1', [req.user.id])
    if (!rows.length) return res.status(404).json({ error: 'Usuario no encontrado' })
    res.json({ user: rows[0] })
  } catch (e: any) {
    res.status(500).json({ error: e.message })
  }
})

// ─── RUTAS WHATSAPP ────────────────────────────────────────────────────────
app.use('/api/whatsapp', requireAuth, waRouter)

// ─── SOCKET.IO EVENTS ──────────────────────────────────────────────────────
io.on('connection', (socket) => {
  const userId = socket.handshake.query.userId as string
  if (userId && userId !== 'undefined' && userId !== 'null') {
    socket.join(`user_${userId}`)
    logger.info(`✅ Socket conectado: ${userId}`)

    // Enviar estado actual de WhatsApp al conectarse
    const session = whatsappWebManager.getSessionSync?.(userId)
    if (session) {
      socket.emit('whatsapp_status', { status: session.status })
      if (session.status === 'connected') {
        socket.emit('whatsapp_ready', { status: 'connected' })
      }
    }
  }

  socket.on('join_user_room', (roomUserId: string) => {
    if (roomUserId) {
      socket.join(`user_${roomUserId}`)
      logger.info(`✅ Socket manual unió a sala: user_${roomUserId}`)
    }
  })

  socket.on('disconnect', () => logger.info('Socket desconectado'))
})

export { io }

// ─── INICIAR SERVIDOR ──────────────────────────────────────────────────────
if (process.env.NODE_ENV !== 'test') {
  httpServer.listen(config.server.port, async () => {
    logger.info(`🚀 LAY CHAT servidor iniciado en puerto ${config.server.port}`)

    try {
      await db.query('SELECT 1')
      logger.info('✅ Base de Datos conectada correctamente')

      // Auto-sync users from Sysbot
      syncUsersFromSysbot().catch(err => {
        logger.warn('⚠️ User sync from Sysbot skipped:', err.message)
      })

      // Auto-iniciar sesiones de WhatsApp guardadas
      whatsappWebManager.initializeAllSessions().catch(err => {
        logger.error('❌ Error al auto-iniciar sesiones WhatsApp:', err)
      })
    } catch (err: any) {
      logger.error('❌ Error conectando a la Base de Datos:', { error: err.message })
    }
  })
}

// ─── GRACEFUL SHUTDOWN ─────────────────────────────────────────────────────
const handleShutdown = async () => {
  logger.info('🛑 Apagando servidor...')
  try {
    await whatsappWebManager.shutdownAll()
  } catch (e) {}
  process.exit(0)
}
process.on('SIGINT', handleShutdown)
process.on('SIGTERM', handleShutdown)

export default app
