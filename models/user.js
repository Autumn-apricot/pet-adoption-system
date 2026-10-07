/**
 * 用户模型
 * 密码一律以 bcrypt 哈希存储，任何出口都不返回 password_hash。
 */
const bcrypt = require('bcryptjs');
const config = require('../config');
const { run, query } = require('../db/db');
const { like } = require('../utils/sql');
const { normalizePagination } = require('../utils/pagination');
const AppError = require('../utils/AppError');

function mapUser(r) {
  if (!r) return null;
  return {
    id: r.id,
    username: r.username,
    nickname: r.nickname,
    role: r.role,
    phone: r.phone,
    status: r.status,
    createdAt: r.created_at,
  };
}

async function hashPassword(plain) {
  return bcrypt.hash(plain, config.bcryptRounds);
}

/**
 * 注册用户。调用方需保证 username 已通过校验。
 */
async function create({ username, password, nickname, role = 'user' }) {
  const exists = await query('SELECT id FROM users WHERE username = ?', [username]);
  if (exists.length > 0) {
    throw new AppError('用户名已存在', 409);
  }

  const hash = await hashPassword(password);
  const rows = await query(
    'INSERT INTO users (username, password_hash, nickname, role) VALUES (?, ?, ?, ?)',
    [username, hash, nickname || username, role]
  );
  return findById(rows.insertId);
}

/** 登录用：带出 password_hash 供比对 */
async function findByUsername(username) {
  const rows = await query('SELECT * FROM users WHERE username = ?', [username]);
  return rows[0] || null;
}

async function findById(id, conn = null) {
  const rows = await run(conn, 'SELECT * FROM users WHERE id = ?', [id]);
  return mapUser(rows[0]);
}

/** 用 bcrypt 常量时间比对，避免时序侧信道 */
async function verifyPassword(plain, hash) {
  return bcrypt.compare(plain, hash);
}

async function updateProfile(id, { nickname, phone }) {
  const fields = [];
  const params = [];
  if (nickname !== undefined) {
    fields.push('nickname = ?');
    params.push(nickname);
  }
  if (phone !== undefined) {
    fields.push('phone = ?');
    params.push(phone);
  }
  if (fields.length === 0) {
    return findById(id);
  }
  params.push(id);
  await query(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`, params);
  return findById(id);
}

async function updatePassword(id, newPassword) {
  const hash = await hashPassword(newPassword);
  await query('UPDATE users SET password_hash = ? WHERE id = ?', [hash, id]);
}

/** 管理员分页查询用户 */
async function list({ page, size, keyword, role }) {
  const { page: p, size: s, offset } = normalizePagination(page, size);

  const clauses = [];
  const params = [];
  if (keyword) {
    clauses.push('(username LIKE ? OR nickname LIKE ?)');
    params.push(like(keyword), like(keyword));
  }
  if (role) {
    clauses.push('role = ?');
    params.push(role);
  }
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';

  const countRows = await query(`SELECT COUNT(*) AS total FROM users ${where}`, params);
  const total = countRows[0].total;

  const rows = await query(
    `SELECT * FROM users ${where} ORDER BY id DESC LIMIT ${s} OFFSET ${offset}`,
    params
  );

  return { list: rows.map(mapUser), total, page: p, size: s };
}

async function setStatus(id, status) {
  const user = await findById(id);
  if (!user) throw new AppError('用户不存在', 404);
  if (user.role === 'admin' && status === 0) {
    throw new AppError('不能禁用管理员账号', 400);
  }
  await query('UPDATE users SET status = ? WHERE id = ?', [status, id]);
  return findById(id);
}

async function remove(id, operatorId) {
  if (Number(id) === Number(operatorId)) {
    throw new AppError('不能删除自己的账号', 400);
  }
  const user = await findById(id);
  if (!user) throw new AppError('用户不存在', 404);
  if (user.role === 'admin') {
    throw new AppError('不能删除管理员账号', 400);
  }
  await query('DELETE FROM users WHERE id = ?', [id]);
  return { id: Number(id) };
}

/** 看板统计 */
async function stats() {
  const rows = await query(
    `SELECT
       COUNT(*) AS total,
       SUM(role = 'admin') AS admins,
       SUM(status = 0) AS disabled,
       SUM(DATE(created_at) = CURDATE()) AS todayNew
     FROM users`
  );
  const r = rows[0] || {};
  return {
    total: Number(r.total || 0),
    admins: Number(r.admins || 0),
    disabled: Number(r.disabled || 0),
    todayNew: Number(r.todayNew || 0),
  };
}

/** 首次启动时确保存在一个管理员账号 */
async function ensureAdmin({ username, password, nickname }) {
  const existing = await findByUsername(username);
  if (existing) return mapUser(existing);
  return create({ username, password, nickname: nickname || '系统管理员', role: 'admin' });
}

module.exports = {
  create,
  findByUsername,
  findById,
  verifyPassword,
  hashPassword,
  updateProfile,
  updatePassword,
  list,
  setStatus,
  remove,
  stats,
  ensureAdmin,
};
