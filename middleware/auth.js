/**
 * 认证与鉴权中间件
 * 之前 JWT 验证逻辑在 router/user.js 里重复了 3 遍，这里统一抽出。
 */
const jwt = require('jsonwebtoken');
const config = require('../config');
const { fail } = require('../utils/response');

/**
 * 校验 Authorization: Bearer <token>，通过后把载荷挂到 req.user。
 */
function auth(req, res, next) {
  const header = req.headers.authorization || '';
  if (!header.startsWith('Bearer ')) {
    return fail(res, 401, '未提供认证 token，请先登录');
  }

  const token = header.slice(7).trim();
  if (!token) {
    return fail(res, 401, '未提供认证 token，请先登录');
  }

  try {
    req.user = jwt.verify(token, config.jwt.secret);
    return next();
  } catch (err) {
    const message = err.name === 'TokenExpiredError' ? 'token 已过期，请重新登录' : 'token 无效';
    return fail(res, 401, message);
  }
}

/**
 * 管理员校验，必须放在 auth 之后。
 */
function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return fail(res, 403, '需要管理员权限');
  }
  return next();
}

/**
 * 签发 token。载荷只放 id / username / role，不放密码等敏感信息。
 */
function signToken(user) {
  return jwt.sign(
    { id: user.id, username: user.username, role: user.role },
    config.jwt.secret,
    { expiresIn: config.jwt.expiresIn }
  );
}

module.exports = { auth, requireAdmin, signToken };
