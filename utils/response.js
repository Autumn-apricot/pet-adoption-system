/**
 * 统一响应格式：{ code, message, data }
 * HTTP 状态码与业务 code 保持一致，便于前端与网关按标准语义处理。
 */

function ok(res, data = null, message = '操作成功') {
  return res.status(200).json({ code: 200, message, data });
}

function fail(res, code = 500, message = '服务器内部错误') {
  return res.status(code).json({ code, message, data: null });
}

function paginated(list, total, page, size) {
  return {
    list,
    total,
    page,
    size,
    pages: size > 0 ? Math.ceil(total / size) : 0,
  };
}

/**
 * express-validator 校验结果统一出口。
 */
function validate(req, res, next) {
  const { validationResult } = require('express-validator');
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return fail(res, 400, errors.array().map((e) => e.msg).join('；'));
  }
  return next();
}

module.exports = { ok, fail, paginated, validate };
