/**
 * 宠物领养管理系统 — 应用入口
 *
 * 职责：装配中间件、挂载路由、托管静态资源，并导出 app 供测试使用。
 * 业务逻辑都在 router / models 层，这里保持尽量薄。
 */
const path = require('path');
const fs = require('fs');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const swaggerUi = require('swagger-ui-express');

const config = require('./config');
const db = require('./db/db');
const apiRouter = require('./router');
const swaggerSpec = require('./docs/swagger');
const { notFound, errorHandler } = require('./middleware/errorHandler');
const { ok } = require('./utils/response');

const app = express();

app.disable('x-powered-by');

// ==================== 中间件 ====================
// swagger-ui 需要内联脚本样式，故关闭 CSP
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false }));

if (config.env !== 'test') {
  app.use(morgan(config.env === 'production' ? 'combined' : 'dev'));
}

// ==================== 健康检查 ====================
app.get('/health', (req, res) => ok(res, {
  status: 'up',
  env: config.env,
  uptime: Math.round(process.uptime()),
  timestamp: new Date().toISOString(),
}));

// ==================== 接口文档 ====================
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  customSiteTitle: '宠物领养管理系统 API 文档',
}));
app.get('/api-docs.json', (req, res) => res.json(swaggerSpec));

// ==================== 业务路由 ====================
app.use('/api', apiRouter);

// ==================== 静态资源 ====================
const publicDir = path.join(__dirname, 'public');
const spaDir = path.join(__dirname, 'web', 'dist');
const spaIndex = path.join(spaDir, 'index.html');
// 前端执行过 npm run build 后，这里就能直接托管构建产物（Docker 镜像即走这条路径）
const spaBuilt = fs.existsSync(spaIndex);

if (spaBuilt) {
  app.use(express.static(spaDir));
}

// 后端自带的接口导航页
app.use(express.static(publicDir));
app.get('/api-guide', (req, res) => res.sendFile(path.join(publicDir, 'index.html')));

if (spaBuilt) {
  // history 模式前端路由兜底：排除 /api、/api-docs、/health、/api-guide 这些后端路径
  app.get(/^\/(?!api(?:[/?]|$)|api-docs|api-guide|health).*/, (req, res) => res.sendFile(spaIndex));
} else {
  app.get('/', (req, res) => res.sendFile(path.join(publicDir, 'index.html')));
}

// ==================== 兜底 ====================
app.use(notFound);
app.use(errorHandler);

// ==================== 启动 ====================
async function bootstrap() {
  try {
    await db.ping();
    console.log(`[数据库] 连接成功 -> ${config.db.user}@${config.db.host}:${config.db.port}/${config.db.database}`);
  } catch (err) {
    console.error('\n[数据库] 连接失败：' + err.message);
    console.error('请检查：');
    console.error('  1. 是否已复制 .env.example 为 .env 并填好数据库账号密码');
    console.error('  2. MySQL 服务是否已启动');
    console.error('  3. 是否已执行 npm run db:init 初始化数据库\n');
    process.exit(1);
  }

  const server = app.listen(config.port, () => {
    console.log('========================================');
    console.log('  宠物领养管理系统已启动');
    console.log(`  访问地址: http://localhost:${config.port}`);
    console.log(`  接口文档: http://localhost:${config.port}/api-docs`);
    if (spaBuilt) {
      console.log('  前端页面: 已托管 web/dist 构建产物');
    } else {
      console.log('  前端页面: 未构建，请到 web/ 目录执行 npm install && npm run dev');
    }
    console.log('========================================');
  });

  const shutdown = async (signal) => {
    console.log(`\n收到 ${signal}，正在优雅关闭...`);
    server.close(async () => {
      await db.close();
      process.exit(0);
    });
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));

  return server;
}

if (require.main === module) {
  bootstrap();
}

module.exports = { app, bootstrap };
