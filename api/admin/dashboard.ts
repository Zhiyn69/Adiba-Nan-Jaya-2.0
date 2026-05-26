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
    
    const today = new Date().toISOString().split('T')[0];
    
    const totalOrders = await db.get("SELECT COUNT(*) as count FROM orders WHERE date(created_at) = $1", [today]);
    const pendingPayments = await db.get("SELECT COUNT(*) as count FROM orders WHERE payment_status = 'pending'");
    const newCustomers = await db.get("SELECT COUNT(*) as count FROM users WHERE role = 'customer' AND date(created_at) = $1", [today]);
    const totalRevenue = await db.get("SELECT SUM(total) as revenue FROM orders WHERE payment_status = 'confirmed'");

    res.json({
      totalOrdersToday: parseInt(totalOrders?.count || "0"),
      pendingPayments: parseInt(pendingPayments?.count || "0"),
      newCustomersToday: parseInt(newCustomers?.count || "0"),
      totalRevenue: parseFloat(totalRevenue?.revenue || "0")
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
}
