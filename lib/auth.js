/**
 * Authentication & Role-Based Access Control (RBAC) Subsystem
 * Native cryptography implementation with zero external runtime dependencies.
 */
import crypto from 'node:crypto';
import logger from './logger.js';
import { authRateLimiter } from './security.js';

const SESSIONS = new Map(); // token -> Session Object
const SESSION_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

export function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
  return `${salt}:${hash}`;
}

export function verifyPassword(password, storedHash) {
  if (!storedHash || !storedHash.includes(':')) return false;
  const [salt, originalHash] = storedHash.split(':');
  const hash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
  return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(originalHash, 'hex'));
}

export const ROLES = {
  SUPER_ADMIN: 'SUPER_ADMIN',
  ADMIN: 'ADMIN',
  OPERATOR: 'OPERATOR'
};

const PERMISSIONS = {
  SUPER_ADMIN: ['*'],
  ADMIN: ['game:control', 'questions:manage', 'participants:manage', 'gifts:manage', 'settings:manage', 'commands:manage', 'logs:view'],
  OPERATOR: ['game:control', 'questions:read', 'participants:view', 'logs:view']
};

class AuthManager {
  constructor(database = null) {
    this.db = database;
    this.users = new Map();
    this.initDefaultUsers();
  }

  setDatabase(db) {
    this.db = db;
  }

  initDefaultUsers() {
    // Production must use an explicitly configured password hash.
    // The development fallback is retained only outside production for local tests.
    const configuredHash = process.env.ADMIN_PASSWORD_HASH;
    const adminPasswordHash = configuredHash || (
      process.env.NODE_ENV === 'production'
        ? hashPassword(crypto.randomBytes(32).toString('hex'))
        : hashPassword(process.env.ADMIN_PASSWORD || 'admin1234')
    );

    const initialSuperAdmin = {
      id: 'admin_super_1',
      username: 'admin',
      passwordHash: adminPasswordHash,
      role: ROLES.SUPER_ADMIN,
      displayName: 'المدير العام',
      createdAt: Date.now(),
      lastLogin: null
    };

    const initialOperator = {
      id: 'admin_op_1',
      username: 'operator',
      passwordHash: hashPassword('operator1234'),
      role: ROLES.OPERATOR,
      displayName: 'مشغل البث',
      createdAt: Date.now(),
      lastLogin: null
    };

    this.users.set(initialSuperAdmin.username, initialSuperAdmin);
    this.users.set(initialOperator.username, initialOperator);
  }

  authenticate(username, password, clientIp = '127.0.0.1') {
    const rateCheck = authRateLimiter.check(clientIp);
    if (!rateCheck.allowed) {
      logger.warn('Auth rate limit exceeded', { ip: clientIp, username });
      return { success: false, error: 'تم تجاوز عدد محاولات تسجيل الدخول المسموح بها. يرجى المحاولة بعد قليل.', code: 429 };
    }

    const user = this.users.get(username);
    if (!user || !verifyPassword(password, user.passwordHash)) {
      logger.warn('Failed login attempt', { username, ip: clientIp });
      return { success: false, error: 'اسم المستخدم أو كلمة المرور غير صحيحة', code: 401 };
    }

    // Create secure session token and CSRF token
    const token = crypto.randomBytes(32).toString('hex');
    const csrfToken = crypto.randomBytes(24).toString('hex');
    const session = {
      token,
      csrfToken,
      userId: user.id,
      username: user.username,
      role: user.role,
      displayName: user.displayName,
      createdAt: Date.now(),
      expiresAt: Date.now() + SESSION_TTL_MS,
      ip: clientIp
    };

    SESSIONS.set(token, session);
    user.lastLogin = Date.now();

    logger.audit('User logged in successfully', { username: user.username, role: user.role, ip: clientIp });

    return {
      success: true,
      token,
      csrfToken,
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        displayName: user.displayName
      },
      expiresAt: session.expiresAt
    };
  }

  validateSession(token) {
    if (!token) return null;
    const session = SESSIONS.get(token);
    if (!session) return null;

    if (Date.now() > session.expiresAt) {
      SESSIONS.delete(token);
      return null;
    }

    return session;
  }

  validateCSRF(session, csrfHeaderToken) {
    if (!session || !session.csrfToken) return false;
    if (!csrfHeaderToken) return false;
    try {
      return crypto.timingSafeEqual(Buffer.from(session.csrfToken), Buffer.from(csrfHeaderToken));
    } catch {
      return false;
    }
  }

  logout(token) {
    if (token && SESSIONS.has(token)) {
      const session = SESSIONS.get(token);
      SESSIONS.delete(token);
      logger.audit('User logged out', { username: session?.username });
      return true;
    }
    return false;
  }

  hasPermission(role, requiredPermission) {
    if (role === ROLES.SUPER_ADMIN) return true;
    const perms = PERMISSIONS[role] || [];
    return perms.includes('*') || perms.includes(requiredPermission);
  }

  getUser(username) {
    const u = this.users.get(username);
    if (!u) return null;
    const { passwordHash, ...safeUser } = u;
    return safeUser;
  }

  getAllUsers() {
    return Array.from(this.users.values()).map(u => {
      const { passwordHash, ...safe } = u;
      return safe;
    });
  }

  createUser({ username, password, role, displayName }, actorRole) {
    if (actorRole !== ROLES.SUPER_ADMIN) {
      return { success: false, error: 'صلاحية غير كافية لإنشاء مستخدمين' };
    }

    if (!username || !password) {
      return { success: false, error: 'اسم المستخدم وكلمة المرور مطلوبان' };
    }

    if (this.users.has(username)) {
      return { success: false, error: 'اسم المستخدم موجود بالفعل' };
    }

    const newUser = {
      id: `usr_${Date.now()}_${Math.random().toString(36).substring(4)}`,
      username: username.trim(),
      passwordHash: hashPassword(password),
      role: role && ROLES[role] ? role : ROLES.OPERATOR,
      displayName: displayName || username,
      createdAt: Date.now(),
      lastLogin: null
    };

    this.users.set(newUser.username, newUser);
    logger.audit('New admin user created', { username: newUser.username, role: newUser.role });

    const { passwordHash, ...safe } = newUser;
    return { success: true, user: safe };
  }

  deleteUser(username, actorRole) {
    if (actorRole !== ROLES.SUPER_ADMIN) {
      return { success: false, error: 'صلاحية غير كافية لحذف المستخدمين' };
    }
    if (username === 'admin') {
      return { success: false, error: 'لا يمكن حذف الحساب الرئيسي' };
    }
    if (!this.users.has(username)) {
      return { success: false, error: 'المستخدم غير موجود' };
    }
    this.users.delete(username);
    logger.audit('Admin user deleted', { username });
    return { success: true };
  }
}

export const authManager = new AuthManager();
export default authManager;
