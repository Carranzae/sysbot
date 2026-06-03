import pg from 'pg';

const { Pool } = pg;

/**
 * Sincroniza usuarios desde la base de datos principal (copilot_expert/Sysbot)
 * hacia la base de datos de Live Chat (livechat).
 * Se ejecuta automáticamente al iniciar el servidor.
 */
export async function syncUsersFromSysbot(): Promise<void> {
  const sysbotPool = new Pool({
    connectionString: process.env.SYSBOT_DATABASE_URL || process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/copilot_expert',
  });

  const livechatPool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/livechat',
  });

  try {
    // Ensure users table exists in livechat DB
    await livechatPool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(255),
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255),
        password VARCHAR(255),
        role VARCHAR(50) DEFAULT 'user',
        phone VARCHAR(50),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // Read users from Sysbot (copilot_expert) - the table is called "User" in Prisma
    const { rows: sysbotUsers } = await sysbotPool.query(`
      SELECT id, name, email, password, role, phone 
      FROM "User" 
      WHERE role IN ('SUPER_ADMIN', 'ADMIN', 'OWNER', 'PROVIDER')
    `);

    if (sysbotUsers.length === 0) {
      console.log('[Sync] No users found in Sysbot DB to sync.');
      return;
    }

    let synced = 0;
    for (const user of sysbotUsers) {
      try {
        await livechatPool.query(
          `INSERT INTO users (id, name, email, password_hash, role, phone, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
           ON CONFLICT (email) DO UPDATE SET
             name = EXCLUDED.name,
             password_hash = EXCLUDED.password_hash,
             role = EXCLUDED.role,
             phone = EXCLUDED.phone,
             updated_at = NOW()`,
          [user.id, user.name, user.email, user.password, user.role?.toLowerCase() || 'user', user.phone]
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
    await sysbotPool.end();
    await livechatPool.end();
  }
}
