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
      const orders = await db.all("SELECT orders.*, users.name as customer_name, users.email as customer_email FROM orders LEFT JOIN users ON orders.user_id = users.id ORDER BY orders.created_at DESC");
      return res.json({ orders });
    }
    
    if (req.method === 'PUT') {
      const id = req.query.id || req.body.id;
      if (!id) return res.status(400).json({ error: 'Order ID required' });
      
      const { order_status } = req.body;
      const order = await db.get("SELECT * FROM orders WHERE id = $1", [id]);
      if (!order) return res.status(404).json({ error: "Order not found" });
      
      await db.run("UPDATE orders SET order_status = $1 WHERE id = $2", [order_status, id]);
      await logAdminAction(auth.admin.id, 'update_order_status', id, order.order_status, order_status);
      
      return res.json({ message: "Status updated" });
    }
    
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
}
