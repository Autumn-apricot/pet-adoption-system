/**
 * 数据库连接模块
 * 使用mysql2创建连接池，封装Promise异步查询方法
 */
const mysql = require('mysql2/promise');

// 创建数据库连接池
const pool = mysql.createPool({
  host: 'localhost',
  user: 'root',
  password: '123456',
  database: 'pet_adoption',
  port: 3306,
  waitForConnections: true,
  connectionLimit: 10,    // 最大连接数
  queueLimit: 0           // 队列限制，0表示无限制
});

/**
 * 封装数据库查询方法，返回Promise对象
 * @param {string} sql - SQL查询语句
 * @param {Array} params - 查询参数数组
 * @returns {Promise} 返回查询结果的Promise
 */
function query(sql, params = []) {
  return new Promise((resolve, reject) => {
    pool.execute(sql, params)
      .then(([rows, fields]) => {
        resolve(rows);
      })
      .catch((err) => {
        console.error('数据库查询错误:', err.message);
        reject(err);
      });
  });
}

module.exports = { query, pool };
