import { Pool, PoolConfig, QueryResult, QueryResultRow } from 'pg'
import dotenv from 'dotenv'

dotenv.config()

const DATABASE_URL = process.env.DATABASE_URL || process.env.DATABASE_PUBLIC_URL
const { NODE_ENV, DATABASE_SSL } = process.env

if (!DATABASE_URL) {
  console.warn('⚠️ DATABASE_URL no está configurada. Configura la conexión a PostgreSQL en tu .env')
}

const poolConfig: PoolConfig = {
  connectionString: DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
  keepAlive: true,
}

const isLocal = DATABASE_URL?.includes('localhost') || DATABASE_URL?.includes('127.0.0.1')

if (DATABASE_SSL === 'true' || (NODE_ENV === 'production' && !isLocal)) {
  poolConfig.ssl = {
    rejectUnauthorized: false,
  }
}

const pool = new Pool(poolConfig)

const maskedConnectionString = poolConfig.connectionString
  ? poolConfig.connectionString.replace(/(postgresql:\/\/[^:]+):[^@]+@/, '$1:****@')
  : 'undefined'

console.log(`🔌 Conectando a PostgreSQL: ${maskedConnectionString}`)

export const db = {
  query: <T extends QueryResultRow = QueryResultRow>(text: string, params?: unknown[]): Promise<QueryResult<T>> => {
    return pool.query<T>(text, params)
  },
  getClient: () => pool.connect(),
}
