import rateLimit from 'express-rate-limit'

const FIFTEEN_MINUTES = 15 * 60 * 1000

const buildJsonResponse = (message: string) => ({
  statusCode: 429,
  message,
})

export const loginRateLimiter = rateLimit({
  windowMs: FIFTEEN_MINUTES,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: buildJsonResponse('Demasiados intentos de inicio de sesión. Intenta nuevamente más tarde.'),
})

export const paymentValidationLimiter = rateLimit({
  windowMs: FIFTEEN_MINUTES,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: buildJsonResponse('Demasiadas validaciones de pago desde esta IP. Intenta más tarde.'),
})
