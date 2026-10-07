/**
 * Express 4 不会自动捕获 async 处理器里抛出的异常，
 * 用这个包一层，把 Promise 的 reject 交给 next() → 统一错误处理中间件。
 */
module.exports = function asyncHandler(fn) {
  return function wrapped(req, res, next) {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};
