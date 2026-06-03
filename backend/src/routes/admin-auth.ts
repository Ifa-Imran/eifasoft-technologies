import { Router, Request, Response, NextFunction } from 'express';
import { query } from '../db/connection';
import * as crypto from 'crypto';

const router = Router();

// ============ Simple Password Hashing (no external deps) ============
function hashPassword(password: string): string {
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
    return `${salt}:${hash}`;
}

function verifyPassword(password: string, stored: string): boolean {
    const [salt, hash] = stored.split(':');
    const verify = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
    return hash === verify;
}

// ============ Simple JWT (no external deps) ============
const JWT_SECRET = process.env.ADMIN_JWT_SECRET || 'kairo-admin-dev-secret-change-me';
const JWT_EXPIRY = 24 * 60 * 60 * 1000; // 24 hours

interface JWTPayload {
    username: string;
    iat: number;
    exp: number;
}

function createToken(username: string): string {
    const payload: JWTPayload = {
        username,
        iat: Date.now(),
        exp: Date.now() + JWT_EXPIRY,
    };
    const data = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const signature = crypto.createHmac('sha256', JWT_SECRET).update(data).digest('base64url');
    return `${data}.${signature}`;
}

function verifyToken(token: string): JWTPayload | null {
    try {
        const [data, signature] = token.split('.');
        if (!data || !signature) return null;
        const expected = crypto.createHmac('sha256', JWT_SECRET).update(data).digest('base64url');
        if (signature !== expected) return null;
        const payload: JWTPayload = JSON.parse(Buffer.from(data, 'base64url').toString());
        if (payload.exp < Date.now()) return null;
        return payload;
    } catch {
        return null;
    }
}

// ============ Middleware: Require Admin JWT ============
export interface AdminRequest extends Request {
    adminUsername?: string;
}

export function requireAdminJWT(req: AdminRequest, res: Response, next: NextFunction): void {
    // Check cookie first, then Authorization header
    const cookieHeader = req.headers.cookie || '';
    const cookies = Object.fromEntries(
        cookieHeader.split(';').map((c) => {
            const [key, ...val] = c.trim().split('=');
            return [key, val.join('=')];
        })
    );
    const token = cookies['admin_token'] || (req.headers.authorization?.replace('Bearer ', '') ?? '');

    if (!token) {
        res.status(401).json({ success: false, error: 'Not authenticated' });
        return;
    }

    const payload = verifyToken(token);
    if (!payload) {
        res.status(401).json({ success: false, error: 'Invalid or expired token' });
        return;
    }

    req.adminUsername = payload.username;
    next();
}

// ============ Seed default admin on first run ============
async function ensureDefaultAdmin(): Promise<void> {
    const defaultPassword = process.env.ADMIN_PASSWORD || 'admin123';
    const existing = await query('SELECT id FROM admin_users WHERE username = $1', ['admin']);
    if (existing.rows.length === 0) {
        const hash = hashPassword(defaultPassword);
        await query(
            'INSERT INTO admin_users (username, password_hash) VALUES ($1, $2) ON CONFLICT DO NOTHING',
            ['admin', hash]
        );
        console.log('Default admin user created (username: admin)');
    }
}

// Run seed on module load (non-blocking)
ensureDefaultAdmin().catch((err) => {
    // Table may not exist yet on first boot before migration
    if (!err.message?.includes('does not exist')) {
        console.error('Failed to seed admin user:', err.message);
    }
});

// ============ Routes ============

/**
 * POST /api/v1/admin/login
 * Body: { username, password }
 */
router.post('/admin/login', async (req: Request, res: Response) => {
    try {
        const { username, password } = req.body;
        if (!username || !password) {
            res.status(400).json({ success: false, error: 'Username and password required' });
            return;
        }

        const result = await query(
            'SELECT username, password_hash FROM admin_users WHERE username = $1',
            [username]
        );

        if (result.rows.length === 0) {
            res.status(401).json({ success: false, error: 'Invalid credentials' });
            return;
        }

        const admin = result.rows[0];
        if (!verifyPassword(password, admin.password_hash)) {
            res.status(401).json({ success: false, error: 'Invalid credentials' });
            return;
        }

        const token = createToken(admin.username);

        // Set httpOnly cookie
        res.setHeader('Set-Cookie', [
            `admin_token=${token}; HttpOnly; Path=/; Max-Age=${JWT_EXPIRY / 1000}; SameSite=Lax${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`,
        ]);

        res.json({ success: true, data: { username: admin.username } });
    } catch (error) {
        console.error('Admin login error:', error);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
});

/**
 * POST /api/v1/admin/logout
 */
router.post('/admin/logout', (_req: Request, res: Response) => {
    res.setHeader('Set-Cookie', [
        `admin_token=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax`,
    ]);
    res.json({ success: true });
});

/**
 * GET /api/v1/admin/me
 */
router.get('/admin/me', requireAdminJWT, (req: AdminRequest, res: Response) => {
    res.json({ success: true, data: { username: req.adminUsername } });
});

export default router;
