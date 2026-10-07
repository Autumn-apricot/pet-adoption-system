/**
 * 测试环境变量。
 * 必须在 require('../config') 之前执行：
 * dotenv 不会覆盖已存在的 process.env，所以这里设的值优先于 .env。
 */
process.env.NODE_ENV = 'test';
process.env.DB_NAME = process.env.TEST_DB_NAME || 'pet_adoption_test';

// 未显式指定时沿用 .env 的数据库地址；CI 或本机多实例可通过环境变量覆盖
if (process.env.TEST_DB_PORT) process.env.DB_PORT = process.env.TEST_DB_PORT;
if (process.env.TEST_DB_HOST) process.env.DB_HOST = process.env.TEST_DB_HOST;
if (process.env.TEST_DB_USER) process.env.DB_USER = process.env.TEST_DB_USER;

module.exports = {};
