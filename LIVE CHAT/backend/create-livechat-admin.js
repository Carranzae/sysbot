import pg from 'pg';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:123@localhost:5432/livechat',
});

async function run() {
  const client = await pool.connect();
  try {
    console.log('🔄 Iniciando creación de tablas y esquema en la base de datos livechat...');
    await client.query('BEGIN');

    // 1. Tabla users
    console.log('👥 Creando tabla "users"...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email VARCHAR(255) UNIQUE NOT NULL,
        name VARCHAR(255),
        phone VARCHAR(50),
        role VARCHAR(50) DEFAULT 'customer',
        password_hash VARCHAR(255),
        payment_gateway VARCHAR(255),
        payment_config JSONB DEFAULT '{}',
        logistics_config JSONB DEFAULT '{}',
        logo_url VARCHAR(255),
        qr_code VARCHAR(255),
        primary_color VARCHAR(50),
        agency_credentials TEXT,
        secure_config TEXT,
        is_active BOOLEAN DEFAULT true,
        commission_rate NUMERIC DEFAULT 0,
        commission_mode VARCHAR(50) DEFAULT 'percentage',
        balance NUMERIC DEFAULT 0,
        whatsapp_config JSONB DEFAULT '{}',
        custom_agencies TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        almacen_phone VARCHAR(50)
      );
    `);

    // 2. Tabla categories
    console.log('📁 Creando tabla "categories"...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS categories (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(255) NOT NULL,
        description TEXT,
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // 3. Tabla products
    console.log('📦 Creando tabla "products"...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS products (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(255) NOT NULL,
        description TEXT,
        price NUMERIC NOT NULL DEFAULT 0,
        min_price NUMERIC,
        discount_max_pct NUMERIC DEFAULT 0.00,
        stock INTEGER DEFAULT 0,
        images JSONB DEFAULT '[]',
        videos JSONB DEFAULT '[]',
        category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        catalog_type VARCHAR(50) DEFAULT 'national',
        lead_time_days INTEGER DEFAULT 0,
        attributes JSONB DEFAULT '{}',
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // 4. Tabla orders
    console.log('🛒 Creando tabla "orders"...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS orders (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        customer_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
        customer_name VARCHAR(255) NOT NULL,
        customer_email VARCHAR(255) NOT NULL,
        customer_phone VARCHAR(50),
        products JSONB NOT NULL DEFAULT '[]',
        total NUMERIC NOT NULL DEFAULT 0,
        paid_amount NUMERIC DEFAULT 0,
        pending_amount NUMERIC DEFAULT 0,
        status VARCHAR(50) DEFAULT 'preparando',
        payment_method VARCHAR(50),
        payment_status VARCHAR(50) DEFAULT 'pending',
        payment_reference_code VARCHAR(255),
        shipping_address TEXT,
        shipping_type VARCHAR(50) DEFAULT 'national',
        tracking_number VARCHAR(255),
        payment_security_code VARCHAR(50),
        customer_id_number VARCHAR(50),
        fulfillment_status VARCHAR(50),
        fulfillment_updated_at TIMESTAMP,
        fulfillment_notes TEXT,
        courier_agency VARCHAR(50),
        guide_number VARCHAR(255),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // 5. Tabla commissions_ledger
    console.log('💸 Creando tabla "commissions_ledger"...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS commissions_ledger (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
        provider_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        total_order_amount NUMERIC NOT NULL DEFAULT 0,
        commission_amount NUMERIC NOT NULL DEFAULT 0,
        net_amount_provider NUMERIC NOT NULL DEFAULT 0,
        status VARCHAR(50) DEFAULT 'recorded',
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // 6. Tabla subscription_plans
    console.log('📋 Creando tabla "subscription_plans"...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS subscription_plans (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(255) NOT NULL,
        slug VARCHAR(50) UNIQUE NOT NULL,
        price NUMERIC DEFAULT 0,
        commission_rate NUMERIC DEFAULT 5,
        max_products INTEGER DEFAULT 50,
        features JSONB DEFAULT '[]',
        is_active BOOLEAN DEFAULT true,
        sort_order INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // 7. Tabla provider_subscriptions
    console.log('📅 Creando tabla "provider_subscriptions"...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS provider_subscriptions (
        provider_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        plan_id UUID REFERENCES subscription_plans(id) ON DELETE CASCADE,
        status VARCHAR(50) DEFAULT 'active',
        starts_at TIMESTAMP DEFAULT NOW(),
        expires_at TIMESTAMP,
        trial_ends_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // 8. Insertar planes básicos si no existen
    console.log('💎 Insertando planes de suscripción básicos...');
    await client.query(`
      INSERT INTO subscription_plans (name, slug, price, commission_rate, max_products, features, sort_order)
      VALUES 
        ('Básico', 'basic', 0, 5, 20, '["whatsapp", "messenger"]', 0),
        ('Pro', 'pro', 99.90, 3, 100, '["whatsapp", "messenger", "instagram", "ai_bot"]', 1),
        ('Enterprise', 'enterprise', 299.90, 1.5, 9999, '["whatsapp", "messenger", "instagram", "ai_bot", "custom_crm", "priority_support"]', 2)
      ON CONFLICT (slug) DO NOTHING;
    `);

    // 9. Inyectar usuario administrador
    console.log('👤 Creando administrador...');
    const adminEmail = 'admin@livechat.com';
    const adminPassword = 'LiveChat2026!';
    const passwordHash = bcrypt.hashSync(adminPassword, 10);
    const adminRole = 'admin_general';

    const { rows: existingAdmin } = await client.query('SELECT id FROM users WHERE email = $1', [adminEmail]);
    if (existingAdmin.length === 0) {
      await client.query(`
        INSERT INTO users (email, name, role, password_hash, is_active)
        VALUES ($1, $2, $3, $4, true)
      `, [adminEmail, 'Administrador LiveChat', adminRole, passwordHash]);
      console.log(`✅ Administrador "${adminEmail}" creado con éxito.`);
    } else {
      await client.query(`
        UPDATE users
        SET password_hash = $2, role = $3, is_active = true
        WHERE email = $1
      `, [adminEmail, passwordHash, adminRole]);
      console.log(`✅ Administrador "${adminEmail}" ya existía. Contraseña y rol actualizados.`);
    }

    await client.query('COMMIT');
    console.log('🎉 ¡Esquema creado y administrador inyectado correctamente en livechat!');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Error al inicializar base de datos:', err);
  } finally {
    client.release();
    await pool.end();
  }
}

run();
