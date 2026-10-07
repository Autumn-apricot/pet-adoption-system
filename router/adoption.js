/**
 * 领养申请路由
 * 普通用户：提交申请、查看我的申请、撤销申请
 * 管理员：查看全部申请、审核、看板统计
 */
const express = require('express');
const { body, param } = require('express-validator');

const adoptionModel = require('../models/adoption');
const { auth, requireAdmin } = require('../middleware/auth');
const { ok, paginated, validate } = require('../utils/response');
const asyncHandler = require('../utils/asyncHandler');

const router = express.Router();

const PHONE_RE = /^1[3-9]\d{9}$/;

/**
 * @openapi
 * /api/adoptions:
 *   post:
 *     tags: [领养申请]
 *     summary: 提交领养申请
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [petId, reason, contactPhone, address]
 *             properties:
 *               petId: { type: integer, example: 1 }
 *               reason: { type: string, example: 家里有院子，有养宠经验 }
 *               contactPhone: { type: string, example: "13800138000" }
 *               address: { type: string, example: 广州市天河区 }
 *     responses:
 *       200: { description: 提交成功 }
 *       400: { description: 宠物不可领养或参数错误 }
 *       409: { description: 重复提交 / 已被领养 }
 */
router.post(
  '/adoptions',
  auth,
  [
    body('petId').isInt({ min: 1 }).withMessage('宠物 ID 不合法'),
    body('reason').trim().notEmpty().withMessage('请填写领养理由')
      .isLength({ max: 500 }).withMessage('领养理由最长 500 个字符'),
    body('contactPhone').trim().matches(PHONE_RE).withMessage('联系电话格式不正确'),
    body('address').trim().notEmpty().withMessage('请填写联系地址')
      .isLength({ max: 200 }).withMessage('联系地址最长 200 个字符'),
  ],
  validate,
  asyncHandler(async (req, res) => {
    const { petId, reason, contactPhone, address } = req.body;
    const adoption = await adoptionModel.create({
      petId,
      applicantId: req.user.id,
      reason,
      contactPhone,
      address,
    });
    return ok(res, adoption, '领养申请已提交，请等待审核');
  })
);

/**
 * @openapi
 * /api/adoptions/mine:
 *   get:
 *     tags: [领养申请]
 *     summary: 我的领养申请
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: query, name: page, schema: { type: integer, default: 1 } }
 *       - { in: query, name: size, schema: { type: integer, default: 10 } }
 *       - { in: query, name: status, schema: { type: string, enum: [pending, approved, rejected, cancelled] } }
 *     responses:
 *       200: { description: 成功 }
 */
router.get(
  '/adoptions/mine',
  auth,
  asyncHandler(async (req, res) => {
    const { page, size, status } = req.query;
    const result = await adoptionModel.listByApplicant(req.user.id, { page, size, status });
    return ok(res, paginated(result.list, result.total, result.page, result.size));
  })
);

/**
 * @openapi
 * /api/adoptions/stats:
 *   get:
 *     tags: [领养申请]
 *     summary: 领养看板统计（管理员）
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: 成功 }
 */
router.get(
  '/adoptions/stats',
  auth,
  requireAdmin,
  asyncHandler(async (req, res) => ok(res, await adoptionModel.stats()))
);

/**
 * @openapi
 * /api/adoptions:
 *   get:
 *     tags: [领养申请]
 *     summary: 分页查询全部领养申请（管理员）
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: query, name: page, schema: { type: integer, default: 1 } }
 *       - { in: query, name: size, schema: { type: integer, default: 10 } }
 *       - { in: query, name: status, schema: { type: string, enum: [pending, approved, rejected, cancelled] } }
 *       - { in: query, name: keyword, schema: { type: string }, description: 匹配宠物名或申请人 }
 *     responses:
 *       200: { description: 成功 }
 */
router.get(
  '/adoptions',
  auth,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const { page, size, status, keyword } = req.query;
    const result = await adoptionModel.list({ page, size, status, keyword });
    return ok(res, paginated(result.list, result.total, result.page, result.size));
  })
);

/**
 * @openapi
 * /api/adoptions/{id}/review:
 *   put:
 *     tags: [领养申请]
 *     summary: 审核领养申请（管理员）
 *     description: 通过后宠物状态变为「已领养」，同一宠物的其它待审申请自动拒绝
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: 审核完成 }
 *       409: { description: 该申请已处理 }
 */
router.put(
  '/adoptions/:id/review',
  auth,
  requireAdmin,
  [
    param('id').isInt({ min: 1 }).withMessage('申请 ID 不合法'),
    body('decision').isIn(['approved', 'rejected']).withMessage('审核结果只能是 approved 或 rejected'),
    body('reviewRemark').optional({ values: 'falsy' }).trim()
      .isLength({ max: 255 }).withMessage('审核意见最长 255 个字符'),
  ],
  validate,
  asyncHandler(async (req, res) => {
    const adoption = await adoptionModel.review({
      id: req.params.id,
      decision: req.body.decision,
      reviewRemark: req.body.reviewRemark,
      reviewerId: req.user.id,
    });
    return ok(res, adoption, req.body.decision === 'approved' ? '已通过该领养申请' : '已拒绝该领养申请');
  })
);

/**
 * @openapi
 * /api/adoptions/{id}:
 *   delete:
 *     tags: [领养申请]
 *     summary: 撤销自己的领养申请
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: 已撤销 }
 *       403: { description: 只能撤销自己提交的申请 }
 */
router.delete(
  '/adoptions/:id',
  auth,
  [param('id').isInt({ min: 1 }).withMessage('申请 ID 不合法')],
  validate,
  asyncHandler(async (req, res) => {
    const adoption = await adoptionModel.cancel(req.params.id, req.user.id);
    return ok(res, adoption, '已撤销该申请');
  })
);

module.exports = router;
