import { Pool } from '@neondatabase/serverless';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

let pool: Pool | null = null;

function convertSql(sql: string) {
  let i = 1;
  return sql.replace(/\?/g, () => `$${i++}`);
}

export async function getDb() {
  if (pool) return getWrapper(pool);

  pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgres://user:pass@host/db',
  });

  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      company TEXT,
      email TEXT UNIQUE NOT NULL,
      phone TEXT,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'customer',
      status TEXT NOT NULL DEFAULT 'active',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      price REAL NOT NULL,
      unit TEXT NOT NULL,
      stock INTEGER NOT NULL DEFAULT 0,
      description TEXT,
      image TEXT,
      updated_by TEXT,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      items TEXT NOT NULL,
      total REAL NOT NULL,
      payment_method TEXT,
      payment_status TEXT DEFAULT 'pending',
      order_status TEXT DEFAULT 'pending',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES users(id)
    );
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS login_logs (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      ip TEXT,
      device TEXT,
      location TEXT,
      status TEXT,
      timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS admin_logs (
      id TEXT PRIMARY KEY,
      admin_id TEXT NOT NULL,
      action TEXT NOT NULL,
      target TEXT,
      old_value TEXT,
      new_value TEXT,
      timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(admin_id) REFERENCES users(id)
    );
  `);

  // Seed default admin
  const adminRes = await pool.query(`SELECT id FROM users WHERE role = 'superadmin' LIMIT 1`);
  const admin = adminRes.rows[0];
  if (!admin) {
    const salt = await bcrypt.genSalt(12);
    const passwordHash = await bcrypt.hash('Admin@2026!', salt);
    
    await pool.query(`
      INSERT INTO users (id, name, company, email, phone, password_hash, role, status)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    `, [
      crypto.randomUUID(),
      'Super Admin',
      'PT Adiba',
      'admin@adiba.com',
      '08000000000',
      passwordHash,
      'superadmin',
      'active'
    ]);
    console.log('✅ Admin seeded: admin@adiba.com / Admin@2026!');
  }

  return getWrapper(pool);
}

function getWrapper(p: Pool) {
  return {
    get: async (sql: string, params: any[] = []) => {
      const res = await p.query(convertSql(sql), params);
      return res.rows[0];
    },
    all: async (sql: string, params: any[] = []) => {
      const res = await p.query(convertSql(sql), params);
      return res.rows;
    },
    run: async (sql: string, params: any[] = []) => {
      await p.query(convertSql(sql), params);
    },
    exec: async (sql: string) => {
      await p.query(sql);
    }
  };
}
