import pg from 'pg';

const { Pool } = pg;

// Helper to rewrite database name to 'livechat'
function getLiveChatDatabaseUrl(originalUrl: string | undefined): string | undefined {
  if (!originalUrl) return originalUrl;
  if (originalUrl.includes('/livechat')) {
    return originalUrl;
  }
  return originalUrl.replace(/\/([^/?]+)(\?.*)?$/, '/livechat$2');
}

// Helper to get the main/Sysbot database URL (ensuring it does not connect to 'livechat')
function getSysbotDatabaseUrl(originalUrl: string | undefined): string | undefined {
  if (!originalUrl) return originalUrl;
  if (originalUrl.includes('/livechat')) {
    // If it points to livechat database, point it back to 'railway' (default) or 'postgres'
    return originalUrl.replace(/\/livechat(\?.*)?$/, '/railway$1');
  }
  return originalUrl;
}

/**
 * Sincroniza usuarios desde la base de datos principal (copilot_expert/Sysbot)
 * hacia la base de datos de Live Chat (livechat).
 * Se ejecuta automáticamente al iniciar el servidor.
 */
export async function syncUsersFromSysbot(): Promise<void> {
  const originalUrl = process.env.DATABASE_URL || process.env.DATABASE_PUBLIC_URL;
  const isProduction = process.env.NODE_ENV === 'production';
  const sslConfig = isProduction ? { rejectUnauthorized: false } : false;

  const sysbotConnectionString = process.env.SYSBOT_DATABASE_URL || getSysbotDatabaseUrl(originalUrl) || 'postgresql://postgres:postgres@localhost:5432/copilot_expert';
  const livechatConnectionString = getLiveChatDatabaseUrl(originalUrl) || 'postgresql://postgres:postgres@localhost:5432/livechat';

  console.log(`[Sync] Conectando a Sysbot DB para lectura: ${sysbotConnectionString.replace(/:([^:@]+)@/, ':****@')}`);
  console.log(`[Sync] Conectando a LiveChat DB para escritura: ${livechatConnectionString.replace(/:([^:@]+)@/, ':****@')}`);

  const sysbotPool = new Pool({
    connectionString: sysbotConnectionString,
    ssl: sslConfig
  });

  const livechatPool = new Pool({
    connectionString: livechatConnectionString,
    ssl: sslConfig
  });

  try {
    // Ensure users table exists in livechat DB
    await livechatPool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id VARCHAR(36) PRIMARY KEY,
        name VARCHAR(255),
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255),
        password VARCHAR(255),
        role VARCHAR(50) DEFAULT 'user',
        phone VARCHAR(50),
        business_id VARCHAR(255),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // Ensure business_id column exists
    await livechatPool.query(`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS business_id VARCHAR(255)
    `);

    // Read users from Sysbot (copilot_expert/railway) - the table is called "users" in Prisma with camelCase columns
    // We join businesses to extract b.id as businessId
    const { rows: sysbotUsers } = await sysbotPool.query(`
      SELECT u.id, u."firstName", u."lastName", u.email, u.password, u.role::text, u.phone, b.id as "businessId"
      FROM "users" u
      LEFT JOIN "businesses" b ON b."ownerId" = u.id
      WHERE u.role::text IN ('SUPER_ADMIN', 'ADMIN', 'OWNER', 'PROVIDER', 'BUSINESS_OWNER')
    `);

    if (sysbotUsers.length === 0) {
      console.log('[Sync] No users found in Sysbot DB to sync.');
      return;
    }

    let synced = 0;
    for (const user of sysbotUsers) {
      try {
        // Map firstName and lastName to name
        const fullName = [user.firstName, user.lastName].filter(Boolean).join(' ') || user.email.split('@')[0];
        // Map role to lowercase to match livechat expectation
        const livechatRole = user.role?.toLowerCase() || 'user';

        await livechatPool.query(
          `INSERT INTO users (id, name, email, password_hash, password, role, phone, business_id, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
           ON CONFLICT (email) DO UPDATE SET
             id = EXCLUDED.id,
             name = EXCLUDED.name,
             password_hash = EXCLUDED.password_hash,
             password = EXCLUDED.password,
             role = EXCLUDED.role,
             phone = EXCLUDED.phone,
             business_id = EXCLUDED.business_id,
             updated_at = NOW()`,
          [user.id, fullName, user.email, user.password, user.password, livechatRole, user.phone, user.businessId]
        );
        synced++;
      } catch (err: any) {
        console.warn(`[Sync] Could not sync user ${user.email}: ${err.message}`);
      }
    }

    console.log(`✅ [Sync] Synchronized ${synced}/${sysbotUsers.length} users from Sysbot → LiveChat`);
  } catch (err: any) {
    console.warn(`⚠️ [Sync] User sync failed (non-fatal): ${err.message}`);
  } finally {
    try {
      await sysbotPool.end();
    } catch (e) {}
    try {
      await livechatPool.end();
    } catch (e) {}
  }
}
