/**
 * 数据库访问层
 * - 连接池统一由 config 提供（主机、端口、账号、密码全部来自环境变量）
 * - query()      普通查询
 * - transaction() 事务封装，用于「审核通过」这类需要多表原子更新的场景
 */
const mysql = require('mysql2/promise');
const config = require('../config');

const pool = mysql.createPool(config.db);

/**
 * 执行 SQL 并返回结果行。
 * 使用 execute()（预编译语句）而非 query()，天然防 SQL 注入。
 * @param {object|null} conn 事务连接，传 null 则使用连接池
 */
async function run(conn, sql, params = []) {
  const target = conn || pool;
  const [rows] = await target.execute(sql, params);
  return rows;
}

async function query(sql, params = []) {
  return run(null, sql, params);
}

/**
 * 事务封装。
 * @param {(conn: import('mysql2/promise').PoolConnection) => Promise<any>} handler
 */
async function transaction(handler) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const result = await handler(conn);
    await conn.commit();
    return result;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

/** 健康检查：启动时确认数据库可达 */
async function ping() {
  const conn = await pool.getConnection();
  try {
    await conn.ping();
  } finally {
    conn.release();
  }
}

async function close() {
  await pool.end();
}

module.exports = { pool, run, query, transaction, ping, close };
