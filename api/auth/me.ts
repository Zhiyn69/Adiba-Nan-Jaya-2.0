import { getDb } from '../../src/database/db';
import { checkCustomerAuth } from '../../src/api/utils';

export default async function handler(req: any, res: any) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const auth = await checkCustomerAuth(req);
  if (auth.error) {
    return res.status(auth.status || 401).json({ error: auth.error });
  }

  const userId = auth.user.id;
  const db = await getDb();
  const user = await db.get('SELECT id, name, company, email, phone, role FROM users WHERE id = $1', [userId]);
  res.json({ user });
}
