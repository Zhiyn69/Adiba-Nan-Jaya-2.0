import { getDb } from '../../src/database/db';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { sanitizeInput, authLimiterCheck, JWT_SECRET, JWT_REFRESH_SECRET } from '../../src/api/utils';
import cookie from 'cookie';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const clientIp = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '127.0.0.1';
  if (!authLimiterCheck(clientIp)) {
    return res.status(429).json({ error: "Terlalu banyak percobaan masuk, silakan coba lagi setelah 15 menit" });
  }

  try {
    const { identifier, password, rememberMe } = req.body || {};
    const sIdentifier = sanitizeInput(identifier)?.toLowerCase();

    if (!sIdentifier || !password) {
       return res.status(400).json({ error: "Email dan password diperlukan" });
    }

    const db = await getDb();
    const user = await db.get(
      'SELECT * FROM users WHERE (email = $1 OR phone = $2) AND role = "customer"',
      [sIdentifier, sIdentifier]
    );

    if (!user || user.role !== 'customer') {
      return res.status(401).json({ error: "Email/Nomor HP atau password salah" });
    }
    
    if (user.status !== 'active') {
      return res.status(403).json({ error: "Akun dinonaktifkan" });
    }

    const isValid = await bcrypt.compare(password, user.password_hash);
    if (!isValid) {
      return res.status(401).json({ error: "Email/Nomor HP atau password salah" });
    }

    const accessToken = jwt.sign(
      { id: user.id, email: user.email, name: user.name, role: user.role },
      JWT_SECRET,
      { expiresIn: "15m" }
    );

    const refreshExpiresIn = rememberMe ? "7d" : "1d";
    const refreshToken = jwt.sign(
      { id: user.id },
      JWT_REFRESH_SECRET,
      { expiresIn: refreshExpiresIn }
    );

    const isProd = process.env.NODE_ENV === "production";
    
    const tokenCookie = cookie.serialize('accessToken', accessToken, {
      httpOnly: true,
      secure: isProd,
      sameSite: "strict",
      maxAge: 15 * 60, // in seconds
      path: '/'
    });
    const refreshCookie = cookie.serialize('refreshToken', refreshToken, {
      httpOnly: true,
      secure: isProd,
      sameSite: "strict",
      maxAge: rememberMe ? 7 * 24 * 60 * 60 : 24 * 60 * 60,
      path: '/'
    });

    res.setHeader('Set-Cookie', [tokenCookie, refreshCookie]);

    res.json({
      message: "Login berhasil",
      accessToken,
      user: {
        id: user.id,
        name: user.name,
        company: user.company,
        email: user.email,
        phone: user.phone,
        role: user.role
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Terjadi kesalahan server" });
  }
}
