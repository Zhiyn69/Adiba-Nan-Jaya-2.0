import { getDb } from '../../src/database/db';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { sanitizeInput, adminAuthLimiterCheck, ADMIN_JWT_SECRET } from '../../src/api/utils';
import crypto from 'crypto';
import cookie from 'cookie';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const clientIp = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '127.0.0.1';
  if (!adminAuthLimiterCheck(clientIp)) {
    return res.status(429).json({ error: "Terlalu banyak percobaan masuk. Akun terkunci selama 30 menit." });
  }

  try {
    const { email, password } = req.body || {};
    const sEmail = sanitizeInput(email)?.toLowerCase();

    const db = await getDb();
    const user = await db.get(
      'SELECT * FROM users WHERE email = $1 AND (role = "admin" OR role = "superadmin")',
      [sEmail]
    );

    if (!user) {
      return res.status(401).json({ error: "Kredensial tidak valid" });
    }
    
    if (user.status !== 'active') {
      return res.status(403).json({ error: "Akun dinonaktifkan" });
    }

    const isValid = await bcrypt.compare(password, user.password_hash);
    
    // Log attempt
    await db.run(
      'INSERT INTO login_logs (id, user_id, ip, device, status) VALUES ($1, $2, $3, $4, $5)',
      [crypto.randomUUID(), user.id, clientIp, req.headers['user-agent'] || '', isValid ? 'success' : 'failed']
    );

    if (!isValid) {
      return res.status(401).json({ error: "Kredensial tidak valid" });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, name: user.name, role: user.role },
      ADMIN_JWT_SECRET,
      { expiresIn: "8h" }
    );

    res.setHeader('Set-Cookie', cookie.serialize('adminToken', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 8 * 60 * 60,
      path: '/'
    }));

    res.json({
      message: "Login admin berhasil",
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Terjadi kesalahan server" });
  }
}
