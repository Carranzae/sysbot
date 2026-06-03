import pg from 'pg';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

const isProduction = process.env.NODE_ENV === 'production';
const originalConnectionString = process.env.DATABASE_URL || process.env.DATABASE_PUBLIC_URL;

// Function to dynamically rewrite the connection string to target the 'livechat' database
function getLiveChatDatabaseUrl(originalUrl) {
  if (!originalUrl) return originalUrl;
  if (originalUrl.includes('/livechat')) {
    return originalUrl;
  }
  // Replace the database name with 'livechat'
  return originalUrl.replace(/\/([^/?]+)(\?.*)?$/, '/livechat$2');
}

const connectionString = getLiveChatDatabaseUrl(originalConnectionString);

async function ensureDatabaseExists() {
  if (!originalConnectionString) return;
  
  // Extract target database name from original connection string
  const match = originalConnectionString.match(/\/([^/?]+)(\?.*)?$/);
  const targetDbName = match ? match[1] : 'livechat';
  
  // If target database name in env is already 'livechat', we connect to 'postgres' to create it.
  // Otherwise, we can connect to the target database (e.g. 'railway') to create 'livechat'.
  let adminDbUrl;
  const finalTargetDb = 'livechat';
  
  if (targetDbName === 'livechat') {
    adminDbUrl = originalConnectionString.replace(/\/livechat(\?.*)?$/, '/postgres$1');
  } else {
    adminDbUrl = originalConnectionString;
  }

  console.log(`🔌 Verificando/Creando base de datos 'livechat' conectando a base de datos administrativa...`);
  
  const client = new pg.Client({
    connectionString: adminDbUrl,
    ssl: isProduction ? { rejectUnauthorized: false } : false
  });
  
  try {
    await client.connect();
    const res = await client.query("SELECT 1 FROM pg_database WHERE datname = $1", [finalTargetDb]);
    if (res.rows.length === 0) {
      console.log(`🔨 Base de datos '${finalTargetDb}' no existe. Creándola...`);
      // CREATE DATABASE cannot run in transactions
      await client.query(`CREATE DATABASE ${finalTargetDb}`);
      console.log(`✅ Base de datos '${finalTargetDb}' creada con éxito.`);
    } else {
      console.log(`ℹ️ Base de datos '${finalTargetDb}' ya existe.`);
    }
  } catch (err) {
    console.warn(`⚠️ Advertencia al verificar/crear base de datos '${finalTargetDb}':`, err.message);
  } finally {
    try {
      await client.end();
    } catch (e) {}
  }
}

async function run() {
  if (!connectionString) {
    console.error('❌ Error: DATABASE_URL o DATABASE_PUBLIC_URL no configurada.');
    process.exit(1);
  }

  try {
    // 1. Ensure target 'livechat' database exists in the PostgreSQL cluster
    await ensureDatabaseExists();

    // 2. Initialize target database connection pool
    const poolConfig = {
      connectionString,
      ssl: isProduction ? { rejectUnauthorized: false } : false
    };
    const pool = new pg.Pool(poolConfig);

    console.log('🔄 Inicializando base de datos (Live Chat)...');
    const sqlPath = path.join(process.cwd(), 'scripts', 'init-db.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    console.log(`🔌 Conectando a la base de datos 'livechat'...`);
    await pool.query(sql);
    console.log('✅ Base de datos (Live Chat) inicializada correctamente.');
    await pool.end();
  } catch (err) {
    console.error('❌ Error al inicializar base de datos:', err.message);
    process.exit(1);
  }
}

run();
