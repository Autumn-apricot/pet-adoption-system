/**
 * 业务异常类。
 * 路由层只需 throw new AppError('提示', 400)，统一由错误处理中间件转成响应，
 * 避免在每个接口里重复写 if / else 分支。
 */
class AppError extends Error {
  constructor(message, code = 500) {
    super(message);
    this.name = 'AppError';
    this.code = code;
  }
}

module.exports = AppError;
