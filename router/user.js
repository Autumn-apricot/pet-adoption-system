/**
 * 用户路由模块
 * 处理用户注册、登录、获取信息等请求
 */
const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const userModel = require('../models/user');

// JWT密钥（实际项目中应放在环境变量中）
const JWT_SECRET = 'pet_adoption_jwt_secret_key_2024';

/**
 * 用户注册接口
 * POST /user/register
 * 接收参数：username（用户名）、password（密码）
 */
router.post('/register', async (req, res, next) => {
  try {
    const { username, password } = req.body;

    // 参数校验
    if (!username || !password) {
      return res.json({
        code: 400,
        message: '用户名和密码不能为空',
        data: null
      });
    }

    const user = await userModel.register(username, password);
    res.json({
      code: 200,
      message: '注册成功',
      data: user
    });
  } catch (err) {
    if (err.message === '用户名已存在') {
      return res.json({
        code: 400,
        message: err.message,
        data: null
      });
    }
    next(err);
  }
});

/**
 * 用户登录接口
 * POST /user/login
 * 接收参数：username（用户名）、password（密码）
 * 登录成功后生成JWT token
 */
router.post('/login', async (req, res, next) => {
  try {
    const { username, password } = req.body;

    // 参数校验
    if (!username || !password) {
      return res.json({
        code: 400,
        message: '用户名和密码不能为空',
        data: null
      });
    }

    const user = await userModel.login(username, password);

    // 生成JWT token，有效期24小时
    const token = jwt.sign(
      { id: user.id, username: user.username },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      code: 200,
      message: '登录成功',
      data: {
        ...user,
        token
      }
    });
  } catch (err) {
    if (err.message === '用户名或密码错误') {
      return res.json({
        code: 400,
        message: err.message,
        data: null
      });
    }
    next(err);
  }
});

/**
 * 获取用户信息接口
 * GET /user/info
 * 需要携带token进行身份验证
 * 接收参数：id（用户ID，通过query传递）
 */
router.get('/info', async (req, res, next) => {
  try {
    // JWT身份认证
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.json({
        code: 401,
        message: '未提供认证token',
        data: null
      });
    }

    const token = authHeader.split(' ')[1];
    let decoded;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch (jwtErr) {
      return res.json({
        code: 401,
        message: 'token无效或已过期',
        data: null
      });
    }

    const { id } = req.query;
    if (!id) {
      return res.json({
        code: 400,
        message: '用户ID不能为空',
        data: null
      });
    }

    const user = await userModel.getUserById(parseInt(id));
    res.json({
      code: 200,
      message: '获取用户信息成功',
      data: user
    });
  } catch (err) {
    if (err.message === '用户不存在') {
      return res.json({
        code: 404,
        message: err.message,
        data: null
      });
    }
    next(err);
  }
});

/**
 * 删除用户接口
 * DELETE /user/delete
 * 需要携带token进行身份验证
 * 接收参数：id（用户ID）
 */
router.delete('/delete', async (req, res, next) => {
  try {
    // JWT身份认证
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.json({
        code: 401,
        message: '未提供认证token',
        data: null
      });
    }

    const token = authHeader.split(' ')[1];
    try {
      jwt.verify(token, JWT_SECRET);
    } catch (jwtErr) {
      return res.json({
        code: 401,
        message: 'token无效或已过期',
        data: null
      });
    }

    const { id } = req.body;
    if (!id) {
      return res.json({
        code: 400,
        message: '用户ID不能为空',
        data: null
      });
    }

    const result = await userModel.deleteUser(parseInt(id));
    res.json({
      code: 200,
      message: '删除用户成功',
      data: result
    });
  } catch (err) {
    if (err.message === '用户不存在') {
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
