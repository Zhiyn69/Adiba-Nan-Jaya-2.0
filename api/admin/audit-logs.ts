import { getDb } from '../../src/database/db';
import { checkAdminAuth } from '../../src/api/utils';

export default async function handler(req: any, res: any) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const auth = await checkAdminAuth(req);
  if (auth.error) {
    return res.status(auth.status || 401).json({ error: auth.error });
  }

  try {
    const db = await getDb();
    const logs = await db.all("SELECT admin_logs.*, users.name as admin_name FROM admin_logs LEFT JOIN users ON admin_logs.admin_id = users.id ORDER BY admin_logs.timestamp DESC");
    res.json({ logs });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
}
