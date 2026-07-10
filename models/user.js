/**
 * 用户模型模块
 * 封装用户相关的数据库操作
 */
const { query } = require('../db/db');

/**
 * 用户注册
 * @param {string} username - 用户名
 * @param {string} password - 密码
 * @returns {Promise} 返回插入结果
 */
async function register(username, password) {
  // 先检查用户名是否已存在
  const checkSql = 'SELECT id FROM users WHERE username = ?';
  const existingUsers = await query(checkSql, [username]);
  if (existingUsers.length > 0) {
    throw new Error('用户名已存在');
  }

  const sql = 'INSERT INTO users (username, password) VALUES (?, ?)';
  const result = await query(sql, [username, password]);
  return { id: result.insertId, username };
}

/**
 * 用户登录
 * @param {string} username - 用户名
 * @param {string} password - 密码
 * @returns {Promise} 返回用户信息
 */
async function login(username, password) {
  const sql = 'SELECT id, username FROM users WHERE username = ? AND password = ?';
  const users = await query(sql, [username, password]);
  if (users.length === 0) {
    throw new Error('用户名或密码错误');
  }
  return users[0];
}

/**
 * 根据ID获取用户信息
 * @param {number} id - 用户ID
 * @returns {Promise} 返回用户详情
 */
async function getUserById(id) {
  const sql = 'SELECT id, username FROM users WHERE id = ?';
  const users = await query(sql, [id]);
  if (users.length === 0) {
    throw new Error('用户不存在');
  }
  return users[0];
}

/**
 * 根据ID删除用户
 * @param {number} id - 用户ID
 * @returns {Promise} 返回删除结果
 */
async function deleteUser(id) {
  const checkSql = 'SELECT id FROM users WHERE id = ?';
  const existingUsers = await query(checkSql, [id]);
  if (existingUsers.length === 0) {
    throw new Error('用户不存在');
  }

  const sql = 'DELETE FROM users WHERE id = ?';
  await query(sql, [id]);
  return { message: '删除成功', id };
}

module.exports = { register, login, getUserById, deleteUser };
