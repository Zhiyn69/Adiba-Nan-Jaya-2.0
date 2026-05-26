import { getDb } from '../../src/database/db';
import jwt from 'jsonwebtoken';
import { JWT_SECRET, JWT_REFRESH_SECRET, parseCookies } from '../../src/api/utils';
import cookie from 'cookie';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const cookies = parseCookies(req);
  const refreshToken = cookies.refreshToken;
  
  const clearSession = () => {
    res.setHeader('Set-Cookie', [
      cookie.serialize('refreshToken', '', { maxAge: -1, path: '/' }),
      cookie.serialize('accessToken', '', { maxAge: -1, path: '/' })
    ]);
  };

  if (!refreshToken) return res.status(403).json({ error: "Sesi telah berakhir" });

  try {
    const decoded = jwt.verify(refreshToken, JWT_REFRESH_SECRET) as any;
    const db = await getDb();
    const user = await db.get('SELECT * FROM users WHERE id = $1', [decoded.id]);
    
    if (!user || user.status !== 'active') {
      clearSession();
      return res.status(403).json({ error: "User tidak ditemukan atau dinonaktifkan" });
    }

    const accessToken = jwt.sign(
      { id: user.id, email: user.email, name: user.name, role: user.role },
      JWT_SECRET,
      { expiresIn: "15m" }
    );
    
    res.setHeader('Set-Cookie', cookie.serialize('accessToken', accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 15 * 60,
      path: '/'
    }));

    res.json({ accessToken });
  } catch (err) {
    clearSession();
    return res.status(403).json({ error: "Refresh token invalid atau expired" });
  }
}
