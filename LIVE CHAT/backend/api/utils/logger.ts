type LogLevel = 'info' | 'warn' | 'error'

type LogMeta = Record<string, unknown>

const SENSITIVE_FIELDS = ['token', 'key', 'password', 'secret', 'access_token', 'authorization', 'pin']

const redact = (obj: any): any => {
  if (!obj || typeof obj !== 'object') return obj
  if (Array.isArray(obj)) return obj.map(redact)

  const newObj = { ...obj }
  for (const key in newObj) {
    if (SENSITIVE_FIELDS.some(f => key.toLowerCase().includes(f))) {
      newObj[key] = '[REDACTED]'
    } else if (typeof newObj[key] === 'object') {
      newObj[key] = redact(newObj[key])
    }
  }
  return newObj
}

const print = (level: LogLevel, message: string, meta?: LogMeta) => {
  const payload = {
    level,
    message,
    timestamp: new Date().toISOString(),
    ...(meta && Object.keys(meta).length ? { meta: redact(meta) } : {}),
  }

  const serialized = JSON.stringify(payload)
  if (level === 'error') {
    console.error(serialized)
    return
  }
  if (level === 'warn') {
    console.warn(serialized)
    return
  }
  console.log(serialized)
}

export const logger = {
  info: (message: string, meta?: LogMeta) => print('info', message, meta),
  warn: (message: string, meta?: LogMeta) => print('warn', message, meta),
  error: (message: string, meta?: LogMeta) => print('error', message, meta),
}
