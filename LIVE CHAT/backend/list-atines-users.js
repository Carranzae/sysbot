import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

// Conectamos a app_negocio de atines
const pool = new Pool({
  connectionString: 'postgresql://postgres:bmrx1521@localhost:5432/app_negocio',
});

async function run() {
  try {
    const { rows } = await pool.query('SELECT id, email, name, role, password_hash, phone FROM users');
    console.log('👥 USUARIOS DE ATINES:');
    console.log(JSON.stringify(rows, null, 2));
  } catch (err) {
    console.error('❌ Error al listar usuarios:', err.message);
  } finally {
    await pool.end();
  }
}

run();
