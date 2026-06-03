import pg from 'pg';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

const isProduction = process.env.NODE_ENV === 'production';
const connectionString = process.env.DATABASE_URL || process.env.DATABASE_PUBLIC_URL;
const poolConfig = {
  connectionString,
  ssl: isProduction ? { rejectUnauthorized: false } : false
};

const pool = new pg.Pool(poolConfig);

async function run() {
  try {
    console.log('🔄 Inicializando base de datos...');
    const sqlPath = path.join(process.cwd(), 'scripts', 'init-db.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    console.log('🔌 Conectando a PostgreSQL...');
    await pool.query(sql);
    console.log('✅ Base de datos inicializada correctamente.');
  } catch (err) {
    console.error('❌ Error al inicializar base de datos:', err.message);
  } finally {
    await pool.end();
  }
}

run();
