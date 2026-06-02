import pg from 'pg';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function run() {
  try {
    console.log('🔄 Inicializando base de datos...');
    const sqlPath = 'c:/Users/auner/Desktop/atines/backend/scripts/postgres-schema.sql';
    const sql = fs.readFileSync(sqlPath, 'utf8');

    console.log('🔌 Conectando a PostgreSQL...');
    await pool.query(sql);
    console.log('✅ Base de datos inicializada correctamente con tablas y usuario Administrador.');
  } catch (err) {
    console.error('❌ Error al inicializar base de datos:', err.message);
  } finally {
    await pool.end();
  }
}

run();
