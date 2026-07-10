/**
 * 宠物模型模块
 * 封装宠物信息相关的数据库操作
 */
const { query } = require('../db/db');

/**
 * 添加宠物信息
 * @param {string} category - 宠物分类
 * @param {string} name - 宠物名称
 * @param {string} sex - 性别
 * @param {number} age - 年龄
 * @returns {Promise} 返回插入结果
 */
async function addPet(category, name, sex, age) {
  const sql = 'INSERT INTO pets (category, name, sex, age) VALUES (?, ?, ?, ?)';
  const result = await query(sql, [category, name, sex, age]);
  return { id: result.insertId, category, name, sex, age };
}

/**
 * 获取所有宠物列表
 * @returns {Promise} 返回宠物列表
 */
async function getPetList() {
  const sql = 'SELECT * FROM pets ORDER BY id DESC';
  return await query(sql);
}

/**
 * 根据关键字搜索宠物（模糊查询名称或分类）
 * @param {string} keyword - 搜索关键字
 * @returns {Promise} 返回匹配的宠物列表
 */
async function searchPets(keyword) {
  const sql = 'SELECT * FROM pets WHERE name LIKE ? OR category LIKE ? ORDER BY id DESC';
  const likeKeyword = `%${keyword}%`;
  return await query(sql, [likeKeyword, likeKeyword]);
}

/**
 * 根据ID删除宠物信息
 * @param {number} id - 宠物ID
 * @returns {Promise} 返回删除结果
 */
async function deletePet(id) {
  const checkSql = 'SELECT id FROM pets WHERE id = ?';
  const existingPets = await query(checkSql, [id]);
  if (existingPets.length === 0) {
    throw new Error('宠物记录不存在');
  }

  const sql = 'DELETE FROM pets WHERE id = ?';
  await query(sql, [id]);
  return { message: '删除成功', id };
}

module.exports = { addPet, getPetList, searchPets, deletePet };
