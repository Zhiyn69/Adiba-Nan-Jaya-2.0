import { getDb } from '../../src/database/db';
import { checkAdminAuth, logAdminAction } from '../../src/api/utils';

export default async function handler(req: any, res: any) {
  const auth = await checkAdminAuth(req);
  if (auth.error) {
    return res.status(auth.status || 401).json({ error: auth.error });
  }

  try {
    const db = await getDb();
    
    if (req.method === 'GET') {
      const customers = await db.all("SELECT id, name, company, email, phone, status, created_at FROM users WHERE role = 'customer' ORDER BY created_at DESC");
      return res.json({ customers });
    }
    
    if (req.method === 'PUT') {
      // In a real Vercel app with a dynamic route, the ID comes from req.query.id
      // Since it's a fixed file, we assume ID comes from body or query manually,
      // but if the UI sends it as /api/admin/customers?id=..., we use req.query.id
      const id = req.query.id || req.body.id;
      if (!id) return res.status(400).json({ error: 'Customer ID required' });
      
      const { status } = req.body;
      const user = await db.get("SELECT * FROM users WHERE id = $1", [id]);
      if (!user) return res.status(404).json({ error: "User not found" });
      if (user.role === 'superadmin') return res.status(403).json({ error: "Cannot modify superadmin" });
      
      await db.run("UPDATE users SET status = $1 WHERE id = $2", [status, id]);
      await logAdminAction(auth.admin.id, 'update_customer_status', id, user.status, status);
      
      return res.json({ message: "Status updated" });
    }
    
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
}
