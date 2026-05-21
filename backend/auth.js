import crypto from 'crypto';
import User from './models/User.js';

// ===== PASSWORD HASHING =====
export function hashPassword(password) {
  return new Promise((resolve, reject) => {
    const salt = crypto.randomBytes(16).toString('hex');
    crypto.scrypt(password, salt, 64, (err, derived) => {
      if (err) reject(err);
      resolve(salt + ':' + derived.toString('hex'));
    });
  });
}

export function verifyPassword(password, hash) {
  return new Promise((resolve, reject) => {
    const [salt, key] = hash.split(':');
    crypto.scrypt(password, salt, 64, (err, derived) => {
      if (err) reject(err);
      resolve(key === derived.toString('hex'));
    });
  });
}

// ===== TOKEN MANAGEMENT =====
const tokens = new Map(); // token -> { userId, createdAt }

export function generateToken(userId) {
  const token = crypto.randomBytes(48).toString('hex');
  tokens.set(token, { userId, createdAt: Date.now() });
  return token;
}

export function getUserIdFromToken(token) {
  const entry = tokens.get(token);
  if (!entry) return null;
  // Tokens expire after 24 hours
  if (Date.now() - entry.createdAt > 24 * 60 * 60 * 1000) {
    tokens.delete(token);
    return null;
  }
  return entry.userId;
}

export function removeToken(token) {
  tokens.delete(token);
}

// ===== MIDDLEWARE =====
export function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token de autenticación requerido' });
  }
  const token = authHeader.slice(7);
  const userId = getUserIdFromToken(token);
  if (!userId) {
    return res.status(401).json({ error: 'Token inválido o expirado' });
  }
  const user = User.findById(userId);
  if (!user) {
    return res.status(401).json({ error: 'Usuario no encontrado' });
  }
  req.user = user;
  req.token = token;
  next();
}

export function requireAdmin(req, res, next) {
  requireAuth(req, res, () => {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Acceso denegado. Se requiere rol de administrador.' });
    }
    next();
  });
}

// ===== SEED ADMIN =====
export async function seedAdmin() {
  const existingAdmin = User.findOne({ role: 'admin' });
  if (existingAdmin) {
    console.log('✅ Admin ya existe:', existingAdmin.email);
    return;
  }
  const hashedPw = await hashPassword('admin123');
  User.create({
    _id: `user-admin-${Date.now()}`,
    first_name: 'Admin',
    paternal_last_name: 'CenVote',
    maternal_last_name: '',
    phone: '',
    email: 'admin@cenvote.com',
    password: hashedPw,
    role: 'admin',
    wallet_address: null,
    created_at: new Date().toISOString()
  });
  console.log('🔐 Admin creado: admin@cenvote.com / admin123');
}
