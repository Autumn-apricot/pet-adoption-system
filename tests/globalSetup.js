/**
 * Jest 全局前置：重建一个干净的测试库并建表、创建管理员。
 * 测试库名固定为 pet_adoption_test（见 tests/env.js），不会碰开发库。
 */
require('./env');
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

module.exports = async () => {
  const config = require('../config');

  const conn = await mysql.createConnection({
    host: config.db.host,
    port: config.db.port,
    user: config.db.user,
    password: config.db.password,
    multipleStatements: true,
  });

  try {
    await conn.query(`DROP DATABASE IF EXISTS \`${config.db.database}\``);
    await conn.query(
      `CREATE DATABASE \`${config.db.database}\`
       DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
    );
    await conn.query(`USE \`${config.db.database}\``);
    await conn.query(fs.readFileSync(path.join(__dirname, '..', 'init.sql'), 'utf8'));
  } finally {
    await conn.end();
  }

  const userModel = require('../models/user');
  const db = require('../db/db');
  await userModel.ensureAdmin({ username: 'admin', password: 'admin123', nickname: '测试管理员' });
  await db.close();
};
