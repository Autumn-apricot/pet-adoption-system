/**
 * 用户与认证路由
 *   /api/auth/*   注册、登录、个人资料
 *   /api/users/*  管理员用户管理
 */
const express = require('express');
const { body, param } = require('express-validator');

const userModel = require('../models/user');
const { auth, requireAdmin, signToken } = require('../middleware/auth');
const { ok, paginated, validate } = require('../utils/response');
const asyncHandler = require('../utils/asyncHandler');
const AppError = require('../utils/AppError');

const router = express.Router();

const USERNAME_RE = /^[a-zA-Z0-9_]{3,20}$/;
const PHONE_RE = /^1[3-9]\d{9}$/;

/** 对外返回的用户结构，绝不包含 password_hash */
function toPublic(user) {
  return {
    id: user.id,
    username: user.username,
    nickname: user.nickname,
    role: user.role,
    phone: user.phone,
    status: user.status,
  };
}

/**
 * @openapi
 * /api/auth/register:
 *   post:
 *     tags: [认证]
 *     summary: 用户注册
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [username, password]
 *             properties:
 *               username: { type: string, example: zhangsan }
 *               password: { type: string, example: "123456" }
 *               nickname: { type: string, example: 张三 }
 *     responses:
 *       200: { description: 注册成功 }
 *       400: { description: 参数校验失败 }
 *       409: { description: 用户名已存在 }
 */
router.post(
  '/auth/register',
  [
    body('username').trim().matches(USERNAME_RE).withMessage('用户名需为 3-20 位字母、数字或下划线'),
    body('password').isLength({ min: 6, max: 32 }).withMessage('密码长度需为 6-32 位'),
    body('nickname').optional({ values: 'falsy' }).trim().isLength({ max: 20 }).withMessage('昵称最长 20 个字符'),
  ],
  validate,
  asyncHandler(async (req, res) => {
    const { username, password, nickname } = req.body;
    const user = await userModel.create({ username, password, nickname });
    return ok(res, toPublic(user), '注册成功');
  })
);

/**
 * @openapi
 * /api/auth/login:
 *   post:
 *     tags: [认证]
 *     summary: 用户登录，返回 JWT
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [username, password]
 *             properties:
 *               username: { type: string, example: admin }
 *               password: { type: string, example: admin123 }
 *     responses:
 *       200: { description: 登录成功，data 内含 token }
 *       400: { description: 用户名或密码错误 }
 *       403: { description: 账号已被禁用 }
 */
router.post(
  '/auth/login',
  [
    body('username').trim().notEmpty().withMessage('用户名不能为空'),
    body('password').notEmpty().withMessage('密码不能为空'),
  ],
  validate,
  asyncHandler(async (req, res) => {
    const { username, password } = req.body;

    const user = await userModel.findByUsername(username);
    // 用户不存在与密码错误返回同一提示，避免账号枚举
    if (!user) throw new AppError('用户名或密码错误', 400);

    const matched = await userModel.verifyPassword(password, user.password_hash);
    if (!matched) throw new AppError('用户名或密码错误', 400);

    if (user.status === 0) throw new AppError('账号已被禁用，请联系管理员', 403);

    const token = signToken(user);
    return ok(res, { token, user: toPublic(user) }, '登录成功');
  })
);

/**
 * @openapi
 * /api/auth/profile:
 *   get:
 *     tags: [认证]
 *     summary: 获取当前登录用户资料
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: 成功 }
 *       401: { description: 未认证 }
 */
router.get(
  '/auth/profile',
  auth,
  asyncHandler(async (req, res) => {
    const user = await userModel.findById(req.user.id);
    if (!user) throw new AppError('用户不存在', 404);
    return ok(res, toPublic(user));
  })
);

/**
 * @openapi
 * /api/auth/profile:
 *   put:
 *     tags: [认证]
 *     summary: 修改个人资料
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: 修改成功 }
 */
router.put(
  '/auth/profile',
  auth,
  [
    body('nickname').optional({ values: 'falsy' }).trim().isLength({ max: 20 }).withMessage('昵称最长 20 个字符'),
    body('phone').optional({ values: 'falsy' }).trim().matches(PHONE_RE).withMessage('手机号格式不正确'),
  ],
  validate,
  asyncHandler(async (req, res) => {
    const user = await userModel.updateProfile(req.user.id, {
      nickname: req.body.nickname,
      phone: req.body.phone,
    });
    return ok(res, toPublic(user), '资料已更新');
  })
);

/**
 * @openapi
 * /api/auth/password:
 *   put:
 *     tags: [认证]
 *     summary: 修改密码（需校验原密码）
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: 密码修改成功 }
 *       400: { description: 原密码不正确 }
 */
router.put(
  '/auth/password',
  auth,
  [
    body('oldPassword').notEmpty().withMessage('请输入原密码'),
    body('newPassword').isLength({ min: 6, max: 32 }).withMessage('新密码长度需为 6-32 位'),
  ],
  validate,
  asyncHandler(async (req, res) => {
    const { oldPassword, newPassword } = req.body;
    const current = await userModel.findByUsername(req.user.username);
    if (!current) throw new AppError('用户不存在', 404);

    const matched = await userModel.verifyPassword(oldPassword, current.password_hash);
    if (!matched) throw new AppError('原密码不正确', 400);

    await userModel.updatePassword(req.user.id, newPassword);
    return ok(res, null, '密码修改成功，请重新登录');
  })
);

/**
 * @openapi
 * /api/users:
 *   get:
 *     tags: [用户管理]
 *     summary: 分页查询用户列表（管理员）
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: query, name: page, schema: { type: integer, default: 1 } }
 *       - { in: query, name: size, schema: { type: integer, default: 10 } }
 *       - { in: query, name: keyword, schema: { type: string } }
 *       - { in: query, name: role, schema: { type: string, enum: [user, admin] } }
 *     responses:
 *       200: { description: 成功 }
 *       403: { description: 需要管理员权限 }
 */
router.get(
  '/users',
  auth,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const { page, size, keyword, role } = req.query;
    const result = await userModel.list({ page, size, keyword, role });
    return ok(res, paginated(result.list, result.total, result.page, result.size));
  })
);

/**
 * @openapi
 * /api/users/stats:
 *   get:
 *     tags: [用户管理]
 *     summary: 用户看板统计（管理员）
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: 成功 }
 */
router.get(
  '/users/stats',
  auth,
  requireAdmin,
  asyncHandler(async (req, res) => ok(res, await userModel.stats()))
);

/**
 * @openapi
 * /api/users/{id}/status:
 *   put:
 *     tags: [用户管理]
 *     summary: 启用 / 禁用用户（管理员）
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: 成功 }
 */
router.put(
  '/users/:id/status',
  auth,
  requireAdmin,
  [
    param('id').isInt({ min: 1 }).withMessage('用户 ID 不合法'),
    body('status').isIn([0, 1]).withMessage('status 只能是 0 或 1'),
  ],
  validate,
  asyncHandler(async (req, res) => {
    const user = await userModel.setStatus(req.params.id, Number(req.body.status));
    return ok(res, toPublic(user), Number(req.body.status) === 1 ? '已启用' : '已禁用');
  })
);

/**
 * @openapi
 * /api/users/{id}:
 *   delete:
 *     tags: [用户管理]
 *     summary: 删除用户（管理员）
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: 成功 }
 */
router.delete(
  '/users/:id',
  auth,
  requireAdmin,
  [param('id').isInt({ min: 1 }).withMessage('用户 ID 不合法')],
  validate,
  asyncHandler(async (req, res) => {
    const result = await userModel.remove(req.params.id, req.user.id);
    return ok(res, result, '删除成功');
  })
);

module.exports = { router, toPublic };
