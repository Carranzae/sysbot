import pg from 'pg';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

dotenv.config();

const { Pool } = pg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const isProduction = process.env.NODE_ENV === 'production';
const poolConfig = {
  connectionString: process.env.DATABASE_URL,
  ssl: isProduction ? { rejectUnauthorized: false } : false
};

const pool = new Pool(poolConfig);

async function run() {
  try {
    console.log('🔄 Inicializando base de datos...');
    const sqlPath = path.join(__dirname, 'scripts', 'init-db.sql');
    
    // Check if SQL file exists
    if (!fs.existsSync(sqlPath)) {
      console.log('⚠️ Archivo init-db.sql no encontrado. Saltando inicialización SQL.');
      return;
    }
    
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

