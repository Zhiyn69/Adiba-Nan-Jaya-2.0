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
    const type = req.query.type;

    if (type === 'login') {
      const logs = await db.all("SELECT login_logs.*, users.name, users.email FROM login_logs LEFT JOIN users ON login_logs.user_id = users.id ORDER BY login_logs.timestamp DESC LIMIT 100");
      return res.json({ logs });
    } else if (type === 'audit') {
      const logs = await db.all("SELECT admin_logs.*, users.name as admin_name FROM admin_logs LEFT JOIN users ON admin_logs.admin_id = users.id ORDER BY admin_logs.timestamp DESC");
      return res.json({ logs });
    } else {
      // If no type specified, return both
      const loginLogs = await db.all("SELECT login_logs.*, users.name, users.email FROM login_logs LEFT JOIN users ON login_logs.user_id = users.id ORDER BY login_logs.timestamp DESC LIMIT 100");
      const auditLogs = await db.all("SELECT admin_logs.*, users.name as admin_name FROM admin_logs LEFT JOIN users ON admin_logs.admin_id = users.id ORDER BY admin_logs.timestamp DESC");
      return res.json({ loginLogs, auditLogs });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
}
