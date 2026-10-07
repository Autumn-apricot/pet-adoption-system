/**
 * OpenAPI 3 文档：由 router/*.js 里的 @openapi JSDoc 注释自动汇总生成。
 * 访问 /api-docs 查看在线文档，访问 /api-docs.json 获取原始 JSON。
 */
const path = require('path');
const swaggerJsdoc = require('swagger-jsdoc');
const pkg = require('../package.json');
const config = require('../config');

const definition = {
  openapi: '3.0.3',
  info: {
    title: '宠物领养管理系统 API',
    version: pkg.version,
    description: [
      '宠物领养管理系统的 RESTful 后端接口。',
      '',
      '**统一响应格式**：`{ code, message, data }`，HTTP 状态码与 `code` 保持一致。',
      '',
      '**认证方式**：登录后拿到 JWT，后续请求在请求头带上 `Authorization: Bearer <token>`。',
      '',
      '**默认管理员账号**：`admin / admin123`（首次执行 `npm run db:init` 时创建）。',
    ].join('\n'),
  },
  servers: [
    { url: `http://localhost:${config.port}`, description: '本地开发环境' },
    { url: 'http://localhost:3000', description: '默认端口' },
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
      },
    },
  },
  tags: [
    { name: '认证', description: '注册、登录、个人资料' },
    { name: '用户管理', description: '管理员用户管理' },
    { name: '宠物', description: '宠物信息发布与查询' },
    { name: '领养申请', description: '领养申请、审核与统计' },
  ],
};

module.exports = swaggerJsdoc({
  definition,
  // 注意：Windows 下 path.join 产出的是反斜杠路径（D:\...\router\*.js），
  // swagger-jsdoc 内部无法正确解析，会导致 paths 为空、文档页什么接口都列不出来。
  // 这里统一转成正斜杠，保证 Windows / Linux / macOS 行为一致。
  apis: [path.join(__dirname, '..', 'router', '*.js').split(path.sep).join('/')],
});
