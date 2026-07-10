/**
 * 宠物路由模块
 * 处理宠物信息的增删查等请求
 */
const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const petModel = require('../models/pet');

// JWT密钥
const JWT_SECRET = 'pet_adoption_jwt_secret_key_2024';

/**
 * JWT认证中间件
 * 验证请求头中的token是否有效
 */
function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.json({
      code: 401,
      message: '未提供认证token，请先登录',
      data: null
    });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded; // 将解码后的用户信息挂载到req上
    next();
  } catch (err) {
    return res.json({
      code: 401,
      message: 'token无效或已过期，请重新登录',
      data: null
    });
  }
}

// 所有宠物接口都需要认证
router.use(authMiddleware);

/**
 * 添加宠物信息接口
 * POST /pet/add
 * 接收参数：category（分类）、name（名称）、sex（性别）、age（年龄）
 */
router.post('/add', async (req, res, next) => {
  try {
    const { category, name, sex, age } = req.body;

    // 参数校验
    if (!category || !name || !sex || age === undefined) {
      return res.json({
        code: 400,
        message: '宠物分类、名称、性别、年龄不能为空',
        data: null
      });
    }

    const pet = await petModel.addPet(category, name, sex, parseInt(age));
    res.json({
      code: 200,
      message: '添加宠物信息成功',
      data: pet
    });
  } catch (err) {
    next(err);
  }
});

/**
 * 获取宠物列表接口
 * GET /pet/list
 * 查询所有宠物信息
 */
router.get('/list', async (req, res, next) => {
  try {
    const pets = await petModel.getPetList();
    res.json({
      code: 200,
      message: '获取宠物列表成功',
      data: pets
    });
  } catch (err) {
    next(err);
  }
});

/**
 * 关键字搜索宠物接口
 * GET /pet/search
 * 接收参数：keyword（搜索关键字）
 * 根据关键字模糊查询宠物名称或分类
 */
router.get('/search', async (req, res, next) => {
  try {
    const { keyword } = req.query;
    if (!keyword) {
      return res.json({
        code: 400,
        message: '搜索关键字不能为空',
        data: null
      });
    }

    const pets = await petModel.searchPets(keyword);
    res.json({
      code: 200,
      message: '搜索宠物信息成功',
      data: pets
    });
  } catch (err) {
    next(err);
  }
});

/**
 * 删除宠物信息接口
 * DELETE /pet/delete
 * 接收参数：id（宠物ID）
 * 根据ID删除指定宠物记录
 */
router.delete('/delete', async (req, res, next) => {
  try {
    const { id } = req.body;
    if (!id) {
      return res.json({
        code: 400,
        message: '宠物ID不能为空',
        data: null
      });
    }

    const result = await petModel.deletePet(parseInt(id));
    res.json({
      code: 200,
      message: '删除宠物信息成功',
      data: result
    });
  } catch (err) {
    if (err.message === '宠物记录不存在') {
      return res.json({
        code: 404,
        message: err.message,
        data: null
      });
    }
    next(err);
  }
});

module.exports = router;
