import { getDb } from '../../src/database/db';
import crypto from 'crypto';

// CSRF wrapper mock for compatibility, a real one would set a cookie and return it
export default async function handler(req: any, res: any) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  return res.json({ csrfToken: crypto.randomBytes(32).toString('hex') });
}
