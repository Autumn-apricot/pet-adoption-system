/**
 * Jest 全局后置：测试跑完删掉测试库，避免在开发机上留下垃圾数据。
 */
require('./env');
const mysql = require('mysql2/promise');

module.exports = async () => {
  const config = require('../config');
  const conn = await mysql.createConnection({
    host: config.db.host,
    port: config.db.port,
    user: config.db.user,
    password: config.db.password,
  });
  try {
    await conn.query(`DROP DATABASE IF EXISTS \`${config.db.database}\``);
  } finally {
    await conn.end();
  }
};
