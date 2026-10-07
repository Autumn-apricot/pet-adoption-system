/**
 * SQL 片段构造小工具
 */

/**
 * 按条件数组拼 WHERE 子句，自动跳过空值。
 * @param {Array<[string, any]>} conditions 形如 [['status = ?', status], ['name LIKE ?', kw]]
 */
function buildWhere(conditions) {
  const clauses = [];
  const params = [];
  for (const [sql, value] of conditions) {
    if (value === undefined || value === null || value === '') continue;
    clauses.push(sql);
    params.push(value);
  }
  return {
    where: clauses.length ? `WHERE ${clauses.join(' AND ')}` : '',
    params,
  };
}

/** LIKE 模糊匹配参数 */
function like(keyword) {
  return `%${String(keyword).replace(/[%_]/g, (m) => `\\${m}`)}%`;
}

module.exports = { buildWhere, like };
