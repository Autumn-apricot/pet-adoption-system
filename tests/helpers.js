/**
 * 测试公共工具
 */
const request = require('supertest');
const { app } = require('../app');
const db = require('../db/db');
const userModel = require('../models/user');
const petModel = require('../models/pet');

const api = () => request(app);

let seq = 0;
function uniqueName(prefix) {
  seq += 1;
  return `${prefix}_${Date.now().toString(36)}${seq}`;
}

async function createUser({ role = 'user', password = '123456', nickname } = {}) {
  const username = uniqueName('u');
  const user = await userModel.create({
    username, password, nickname: nickname || username, role,
  });
  return { user, username, password };
}

async function login(username, password) {
  const res = await api().post('/api/auth/login').send({ username, password });
  if (res.status !== 200) {
    throw new Error(`登录失败: ${JSON.stringify(res.body)}`);
  }
  return res.body.data.token;
}

async function createUserAndLogin(opts = {}) {
  const { user, username, password } = await createUser(opts);
  const token = await login(username, password);
  return { user, username, password, token, auth: `Bearer ${token}` };
}

async function adminSession() {
  const token = await login('admin', 'admin123');
  return { token, auth: `Bearer ${token}` };
}

async function createPet(overrides = {}) {
  return petModel.create({
    name: uniqueName('pet'),
    category: '猫',
    sex: '母',
    age: 6,
    description: '测试用宠物',
    ...overrides,
  });
}

module.exports = {
  api,
  db,
  userModel,
  petModel,
  uniqueName,
  createUser,
  createUserAndLogin,
  adminSession,
  createPet,
};
