import pg from 'pg';

const { Pool } = pg;

const atinesPool = new Pool({
  connectionString: 'postgresql://postgres:123@localhost:5432/copilot_expert',
});

const livechatPool = new Pool({
  connectionString: 'postgresql://postgres:123@localhost:5432/livechat',
});

async function run() {
  try {
    console.log('🔓 Eliminando restricción users_role_check en livechat para soportar todos los roles...');
    await livechatPool.query('ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check');

    console.log('🔄 Extrayendo usuarios de copilot_expert (SaaS)...');
    const { rows: users } = await atinesPool.query('SELECT * FROM users');

    console.log(`👥 Insertando ${users.length} usuarios en livechat...`);
    
    for (const user of users) {
      // Mapear firstName y lastName a name
      const fullName = [user.firstName, user.lastName].filter(Boolean).join(' ') || user.email.split('@')[0];
      
      // Mapear role de SaaS a LiveChat
      let role = 'provider';
      if (user.role === 'SUPER_ADMIN' || user.role === 'ADMIN') {
        role = 'admin_general';
      } else if (user.role === 'STAFF') {
        role = 'warehouse';
      }

      await livechatPool.query(
        `INSERT INTO users (id, email, name, phone, role, password_hash, is_active, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         ON CONFLICT (email) DO UPDATE SET 
           id = EXCLUDED.id,
           name = EXCLUDED.name,
           phone = EXCLUDED.phone,
           role = EXCLUDED.role,
           password_hash = EXCLUDED.password_hash,
           is_active = EXCLUDED.is_active,
           updated_at = EXCLUDED.updated_at`,
        [
          user.id,
          user.email,
          fullName,
          user.phone || null,
          role,
          user.password, // El password de copilot_expert ya está encriptado en bcrypt
          user.isActive ?? true,
          user.createdAt || new Date(),
          user.updatedAt || new Date()
        ]
      );
    }
    
    console.log('✅ ¡Sincronización de usuarios completada con éxito!');
  } catch (err) {
    console.error('❌ Error sincronizando usuarios:', err.message);
  } finally {
    await atinesPool.end();
    await livechatPool.end();
  }
}

run();
