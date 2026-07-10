/**
 * 宠物领养管理系统 — 应用入口文件
 *
 * 功能模块：
 * - 用户管理（注册/登录/获取信息）
 * - 宠物管理（增删查）
 * - 中间件（cors跨域、body解析、日志记录、JWT认证）
 * - 静态资源托管
 * - 统一错误处理
 */
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');

// 导入路由模块
const userRouter = require('./router/user');
const petRouter = require('./router/pet');

// 创建Express应用实例
const app = express();

// 设置服务器端口
const PORT = 3000;

// ==================== 中间件配置 ====================

/**
 * 1. CORS跨域中间件
 * 解决前后端分离开发时的跨域请求问题
 */
app.use(cors());

/**
 * 2. Body-parser中间件
 * 解析POST请求中的JSON格式请求体数据
 */
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));

/**
 * 3. 自定义日志中间件
 * 记录每个请求的URL、请求方式和请求时间
 */
app.use((req, res, next) => {
  const now = new Date();
  const timeStr = now.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
  console.log(`[${timeStr}] ${req.method} ${req.url}`);
  next();
});

// ==================== 路由配置 ====================

// 用户相关路由
app.use('/user', userRouter);

// 宠物相关路由
app.use('/pet', petRouter);

// ==================== 静态资源 ====================

/**
 * 托管public目录下的静态资源
 * 可通过 http://localhost:3000/xxx 直接访问public目录中的文件
 */
app.use(express.static(path.join(__dirname, 'public')));

/**
 * 根路由
 * 返回静态首页（API测试界面）
 */
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ==================== 错误处理 ====================

/**
 * 统一错误处理中间件
 * 捕获异常并返回规范的错误信息格式 {code, message, data}
 * 必须放在所有路由和中间件之后
 */
app.use((err, req, res, next) => {
  console.error('服务器错误:', err.stack);

  // 区分不同类型的错误，返回不同的状态码
  let code = 500;
  let message = '服务器内部错误';

  if (err.type === 'entity.parse.failed') {
    code = 400;
    message = 'JSON格式解析失败，请检查请求体格式';
  } else if (err.message) {
    message = err.message;
  }

  // 统一响应格式
  res.status(500).json({
    code: code,
    message: message,
    data: null
  });
});

// ==================== 启动服务器 ====================

app.listen(PORT, () => {
  console.log('========================================');
  console.log(`  宠物领养管理系统服务器启动成功！`);
  console.log(`  访问地址: http://localhost:${PORT}`);
  console.log(`  接口文档: http://localhost:${PORT}/`);
  console.log('========================================');
});
