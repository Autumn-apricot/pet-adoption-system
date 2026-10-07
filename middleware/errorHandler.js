/**
 * 统一错误处理
 */
const config = require('../config');
const AppError = require('../utils/AppError');
const { fail } = require('../utils/response');

/** 未匹配到任何路由 */
function notFound(req, res) {
  return fail(res, 404, `接口不存在: ${req.method} ${req.originalUrl}`);
}

/** 兜底错误处理，必须挂在所有路由之后 */
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  if (err instanceof AppError) {
    return fail(res, err.code, err.message);
  }

  // body 不是合法 JSON
  if (err && err.type === 'entity.parse.failed') {
    return fail(res, 400, 'JSON 格式解析失败，请检查请求体');
  }

  // 数据库约束
  if (err && err.code === 'ER_DUP_ENTRY') {
    return fail(res, 409, '数据已存在，违反唯一约束');
  }
  if (err && err.code === 'ER_NO_REFERENCED_ROW_2') {
    return fail(res, 400, '关联的数据不存在');
  }
  if (err && err.code === 'ER_ROW_IS_REFERENCED_2') {
    return fail(res, 409, '该记录已被引用，无法删除');
  }
  if (err && (err.code === 'ECONNREFUSED' || err.code === 'PROTOCOL_CONNECTION_LOST')) {
    console.error('[数据库连接失败]', err.message);
    return fail(res, 503, '数据库暂时不可用，请稍后重试');
  }

  console.error('[未处理异常]', err);
  const message = config.env === 'production' ? '服务器内部错误' : err.message || '服务器内部错误';
  return fail(res, 500, message);
}

module.exports = { notFound, errorHandler };
