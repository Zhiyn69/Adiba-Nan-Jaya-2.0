import cookie from 'cookie';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  
  res.setHeader('Set-Cookie', cookie.serialize('adminToken', '', { maxAge: -1, path: '/' }));
  res.json({ message: "Logout admin berhasil" });
}
