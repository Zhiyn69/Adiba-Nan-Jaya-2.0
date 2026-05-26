import { getDb } from '../../src/database/db';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { sanitizeInput } from '../../src/api/utils';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { fullName, companyName, phone, email, password } = req.body || {};
    
    const sEmail = sanitizeInput(email)?.toLowerCase();
    const sFullName = sanitizeInput(fullName);
    const sCompanyName = sanitizeInput(companyName);
    const sPhone = sanitizeInput(phone);
    
    if (!sEmail || !password || !sFullName || !sPhone) {
      return res.status(400).json({ error: "Semua fild yang wajib harus diisi" });
    }
    if (password.length < 8) {
      return res.status(400).json({ error: "Password minimal 8 karakter" });
    }

    const db = await getDb();
    const existing = await db.get('SELECT id FROM users WHERE email = $1', [sEmail]);
    if (existing) {
      return res.status(400).json({ error: "Email sudah terdaftar" });
    }

    const salt = await bcrypt.genSalt(12);
    const passwordHash = await bcrypt.hash(password, salt);

    const userId = crypto.randomUUID();
    
    await db.run(
      'INSERT INTO users (id, name, company, email, phone, password_hash, role, status) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
      [userId, sFullName, sCompanyName, sEmail, sPhone, passwordHash, 'customer', 'active']
    );

    return res.status(201).json({ message: "Registrasi berhasil, silakan login" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Terjadi kesalahan server" });
  }
}
