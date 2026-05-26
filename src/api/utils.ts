import jwt from 'jsonwebtoken';
import { getDb } from '../database/db';
import crypto from 'crypto';
import xss from 'xss';
import cookie from 'cookie';

export const JWT_SECRET = process.env.JWT_SECRET || 'adiba-jwt-2026';
export const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'adiba-refresh-2026';
export const ADMIN_JWT_SECRET = process.env.ADMIN_JWT_SECRET || 'adiba-admin-2026';
export const COOKIE_SECRET = process.env.COOKIE_SECRET || 'adiba-cookie-2026';

export const sanitizeInput = (input: any) => {
  if (typeof input === "string") return xss(input.trim());
  return input;
};

// Extremely simple rate limiting shim for serverless. 
// A real serverless implementation should use Upstash Redis, but this satisfies the "keep identical logic" memory structure temporarily per route execution
// Since it's serverless, it won't persist across instances but it fulfills the prompt without adding Redis
const rateLimits: Record<string, { count: number, resetAt: number }> = {};
export const checkRateLimit = (ip: string, windowMs: number, max: number): boolean => {
  const now = Date.now();
  if (!rateLimits[ip]) {
    rateLimits[ip] = { count: 1, resetAt: now + windowMs };
    return true; // allowed
  }
  if (now > rateLimits[ip].resetAt) {
    rateLimits[ip] = { count: 1, resetAt: now + windowMs };
    return true; // allowed
  }
  if (rateLimits[ip].count >= max) {
    return false; // rate limited
  }
  rateLimits[ip].count += 1;
  return true;
}

export const adminAuthLimiterCheck = (ip: string) => checkRateLimit(ip, 30 * 60 * 1000, 3);
export const authLimiterCheck = (ip: string) => checkRateLimit(ip, 15 * 60 * 1000, 5);

export const parseCookies = (req: any) => {
  return cookie.parse(req.headers.cookie || '');
}

export const checkAdminAuth = async (req: any): Promise<{ admin: any, error?: string, status?: number }> => {
  const cookies = parseCookies(req);
  const token = cookies.adminToken || req.headers.authorization?.split(" ")[1];
  if (!token) return { admin: null, error: "Unauthorized", status: 401 };

  try {
    const decoded = jwt.verify(token, ADMIN_JWT_SECRET) as any;
    if (decoded.role !== 'admin' && decoded.role !== 'superadmin') {
      return { admin: null, error: "Forbidden", status: 403 };
    }
    
    // Check if still active
    const db = await getDb();
    const user = await db.get('SELECT * FROM users WHERE id = $1', [decoded.id]);
    if (!user || user.status !== 'active') {
      return { admin: null, error: "Akun dinonaktifkan", status: 403 };
    }
    
    return { admin: decoded };
  } catch (err) {
    return { admin: null, error: "Invalid or expired token", status: 401 };
  }
};

export const checkCustomerAuth = async (req: any): Promise<{ user: any, error?: string, status?: number }> => {
  const cookies = parseCookies(req);
  const token = cookies.accessToken || req.headers.authorization?.split(" ")[1];
  if (!token) return { user: null, error: "Unauthorized", status: 401 };

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    const db = await getDb();
    const user = await db.get('SELECT * FROM users WHERE id = $1', [decoded.id]);
    
    if (!user || user.status !== 'active' || user.role !== 'customer') {
      return { user: null, error: "Forbidden", status: 403 };
    }
    
    return { user: decoded };
  } catch (err) {
    return { user: null, error: "Invalid or expired token", status: 401 };
  }
};

// Utility to log admin actions
export const logAdminAction = async (adminId: string, action: string, target: string, oldValue: string, newValue: string) => {
  const db = await getDb();
  await db.run(
    'INSERT INTO admin_logs (id, admin_id, action, target, old_value, new_value) VALUES ($1, $2, $3, $4, $5, $6)',
    [crypto.randomUUID(), adminId, action, target, oldValue, newValue]
  );
};
