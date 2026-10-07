const config = require('../config');

/**
 * 归一化分页参数，防止传入过大 size 拖垮数据库。
 */
function normalizePagination(page, size) {
  const p = Math.max(1, parseInt(page, 10) || 1);
  const rawSize = parseInt(size, 10) || config.pagination.defaultSize;
  const s = Math.min(Math.max(1, rawSize), config.pagination.maxSize);
  return { page: p, size: s, offset: (p - 1) * s };
}

module.exports = { normalizePagination };
