/**
 * 宠物路由
 * 读接口对外开放（便于演示与前台浏览），写接口需要管理员权限。
 */
const express = require('express');
const { body, param } = require('express-validator');

const petModel = require('../models/pet');
const { auth, requireAdmin } = require('../middleware/auth');
const { ok, paginated, validate } = require('../utils/response');
const asyncHandler = require('../utils/asyncHandler');
const AppError = require('../utils/AppError');

const router = express.Router();

const STATUS_LIST = Object.values(petModel.STATUS);

/** 空字符串统一当作「未提供」，交给数据库默认值 */
function normalizeBody(body) {
  const out = {};
  Object.entries(body || {}).forEach(([k, v]) => {
    out[k] = v === '' ? undefined : v;
  });
  return out;
}

/**
 * 校验链工厂。
 * 注意：express-validator 的链式调用是「就地修改」，同一条链不能既用于新增又用于更新
 * （调过一次 .optional() 之后会一直保持可选），因此每次调用都重新构建。
 * 无论新增还是更新，只有 name / category / sex / age 是必填，其余字段始终可选。
 */
function petValidators({ allOptional = false } = {}) {
  const must = (chain) => (allOptional ? chain.optional({ values: 'falsy' }) : chain);
  const may = (chain) => chain.optional({ values: 'falsy' });

  return [
    must(body('name')).trim().notEmpty().withMessage('宠物名称不能为空')
      .isLength({ max: 50 }).withMessage('宠物名称最长 50 个字符'),
    must(body('category')).trim().notEmpty().withMessage('宠物分类不能为空')
      .isLength({ max: 30 }).withMessage('分类最长 30 个字符'),
    must(body('sex')).isIn(['公', '母']).withMessage('性别只能是 公 或 母'),
    must(body('age')).isInt({ min: 0, max: 360 }).withMessage('年龄需为 0-360 之间的整数（单位：月）'),

    may(body('breed')).trim().isLength({ max: 50 }).withMessage('品种最长 50 个字符'),
    may(body('weight')).isFloat({ min: 0, max: 200 }).withMessage('体重需为 0-200 之间的数字'),
    may(body('healthStatus')).trim().isLength({ max: 30 }).withMessage('健康状况最长 30 个字符'),
    may(body('description')).trim().isLength({ max: 1000 }).withMessage('描述最长 1000 个字符'),
    may(body('imageUrl')).trim().isLength({ max: 255 }).withMessage('图片地址最长 255 个字符'),
    may(body('status')).isIn(STATUS_LIST).withMessage(`状态只能是 ${STATUS_LIST.join(' / ')}`),
  ];
}

/**
 * @openapi
 * /api/pets:
 *   get:
 *     tags: [宠物]
 *     summary: 分页查询宠物列表（公开）
 *     parameters:
 *       - { in: query, name: page, schema: { type: integer, default: 1 } }
 *       - { in: query, name: size, schema: { type: integer, default: 10 } }
 *       - { in: query, name: keyword, schema: { type: string }, description: 匹配名称/品种/描述 }
 *       - { in: query, name: category, schema: { type: string } }
 *       - { in: query, name: sex, schema: { type: string, enum: [公, 母] } }
 *       - { in: query, name: status, schema: { type: string, enum: [available, pending, adopted, offline] } }
 *     responses:
 *       200: { description: 成功 }
 */
router.get(
  '/pets',
  asyncHandler(async (req, res) => {
    const { page, size, keyword, category, sex, status } = req.query;
    // 未显式指定状态时，对前台隐藏已下架的宠物
    const result = await petModel.list({
      page, size, keyword, category, sex, status, excludeOffline: !status,
    });
    return ok(res, paginated(result.list, result.total, result.page, result.size));
  })
);

/**
 * @openapi
 * /api/pets/categories:
 *   get:
 *     tags: [宠物]
 *     summary: 获取所有宠物分类（公开）
 *     responses:
 *       200: { description: 成功 }
 */
router.get(
  '/pets/categories',
  asyncHandler(async (req, res) => ok(res, await petModel.categories()))
);

/**
 * @openapi
 * /api/pets/stats:
 *   get:
 *     tags: [宠物]
 *     summary: 宠物看板统计（管理员）
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: 成功 }
 */
router.get(
  '/pets/stats',
  auth,
  requireAdmin,
  asyncHandler(async (req, res) => ok(res, await petModel.stats()))
);

/**
 * @openapi
 * /api/pets/{id}:
 *   get:
 *     tags: [宠物]
 *     summary: 宠物详情（公开，浏览量 +1）
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: integer } }
 *     responses:
 *       200: { description: 成功 }
 *       404: { description: 宠物不存在 }
 */
router.get(
  '/pets/:id',
  [param('id').isInt({ min: 1 }).withMessage('宠物 ID 不合法')],
  validate,
  asyncHandler(async (req, res) => {
    const pet = await petModel.findById(req.params.id);
    if (!pet) throw new AppError('宠物不存在', 404);
    await petModel.incrementView(pet.id);
    return ok(res, { ...pet, viewCount: pet.viewCount + 1 });
  })
);

/**
 * @openapi
 * /api/pets:
 *   post:
 *     tags: [宠物]
 *     summary: 新增宠物（管理员）
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: 新增成功 }
 *       403: { description: 需要管理员权限 }
 */
router.post(
  '/pets',
  auth,
  requireAdmin,
  petValidators(),
  validate,
  asyncHandler(async (req, res) => {
    const pet = await petModel.create(normalizeBody(req.body));
    return ok(res, pet, '宠物发布成功');
  })
);

/**
 * @openapi
 * /api/pets/{id}:
 *   put:
 *     tags: [宠物]
 *     summary: 修改宠物信息（管理员）
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: 修改成功 }
 */
router.put(
  '/pets/:id',
  auth,
  requireAdmin,
  [param('id').isInt({ min: 1 }).withMessage('宠物 ID 不合法'), ...petValidators({ allOptional: true })],
  validate,
  asyncHandler(async (req, res) => {
    const existing = await petModel.findById(req.params.id);
    if (!existing) throw new AppError('宠物不存在', 404);

    const pet = await petModel.update(req.params.id, normalizeBody(req.body));
    return ok(res, pet, '修改成功');
  })
);

/**
 * @openapi
 * /api/pets/{id}:
 *   delete:
 *     tags: [宠物]
 *     summary: 删除宠物（管理员，关联的领养申请会级联删除）
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: 删除成功 }
 */
router.delete(
  '/pets/:id',
  auth,
  requireAdmin,
  [param('id').isInt({ min: 1 }).withMessage('宠物 ID 不合法')],
  validate,
  asyncHandler(async (req, res) => {
    const result = await petModel.remove(req.params.id);
    return ok(res, result, '删除成功');
  })
);

module.exports = router;
