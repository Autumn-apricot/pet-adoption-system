#!/usr/bin/env node
/**
 * 数据库初始化脚本
 *
 *   npm run db:init     建库 + 建表 + 创建管理员（不删数据）
 *   npm run db:reset    删库重建 + 创建管理员 + 灌入演示数据
 *   node scripts/init-db.js --seed   只灌演示数据
 */
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

const config = require('../config');

const args = process.argv.slice(2);
const RESET = args.includes('--reset');
const SEED = args.includes('--seed') || RESET;

const ADMIN = {
  username: process.env.ADMIN_USERNAME || 'admin',
  password: process.env.ADMIN_PASSWORD || 'admin123',
  nickname: '系统管理员',
};

function log(msg) {
  console.log(msg);
}

async function createDatabase() {
  const conn = await mysql.createConnection({
    host: config.db.host,
    port: config.db.port,
    user: config.db.user,
    password: config.db.password,
    multipleStatements: true,
  });

  try {
    if (RESET) {
      await conn.query(`DROP DATABASE IF EXISTS \`${config.db.database}\``);
      log(`[1/5] 已删除旧数据库 ${config.db.database}`);
    } else {
      log('[1/5] 检查数据库是否存在');
    }

    await conn.query(
      `CREATE DATABASE IF NOT EXISTS \`${config.db.database}\`
       DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
    );
    await conn.query(`USE \`${config.db.database}\``);

    const schema = fs.readFileSync(path.join(__dirname, '..', 'init.sql'), 'utf8');
    await conn.query(schema);
    log(`[2/5] 建表完成 -> ${config.db.database}`);

    const [tables] = await conn.query('SHOW TABLES');
    log(`        数据表：${tables.map((t) => Object.values(t)[0]).join('、')}`);
  } finally {
    await conn.end();
  }
}

async function seedData() {
  // 延迟 require：确保 dotenv 已通过 config 加载
  const userModel = require('../models/user');
  const petModel = require('../models/pet');
  const adoptionModel = require('../models/adoption');

  const admin = await userModel.ensureAdmin(ADMIN);
  log(`[3/5] 管理员账号就绪 -> ${ADMIN.username} / ${ADMIN.password}`);

  if (!SEED) {
    log('[4/5] 跳过演示数据（如需请加 --seed）');
    log('[5/5] 完成');
    return;
  }

  const demoUsers = [
    { username: 'alice', password: '123456', nickname: '小艾' },
    { username: 'bob', password: '123456', nickname: '阿波' },
    { username: 'carol', password: '123456', nickname: '卡罗' },
  ];
  const users = [];
  for (const u of demoUsers) {
    users.push(await userModel.create(u));
  }
  log(`[3/5] 演示用户 -> ${demoUsers.map((u) => u.username).join('、')}（密码均为 123456）`);

  const demoPets = [
    { name: '奶球', category: '猫', breed: '中华田园猫', sex: '母', age: 6, weight: 3.2, health_status: '健康，已驱虫', description: '性格温顺亲人，喜欢被摸下巴，适合有耐心的家庭。' },
    { name: '旺财', category: '狗', breed: '金毛寻回犬', sex: '公', age: 14, weight: 22.5, health_status: '健康，已打疫苗', description: '精力旺盛，会握手和坐下，适合有院子或经常遛狗的家庭。' },
    { name: '豆豆', category: '狗', breed: '柯基', sex: '公', age: 9, weight: 11.0, health_status: '健康', description: '短腿小可爱，对人友好，和其他宠物相处融洽。' },
    { name: '雪球', category: '猫', breed: '英国短毛猫', sex: '母', age: 12, weight: 4.1, health_status: '健康，已绝育', description: '安静黏人，不吵不闹，适合上班族。' },
    { name: '棉花糖', category: '兔', breed: '垂耳兔', sex: '母', age: 4, weight: 1.6, health_status: '健康', description: '毛很软，胆子略小，需要安静环境。' },
    { name: '大黑', category: '狗', breed: '拉布拉多', sex: '公', age: 24, weight: 28.0, health_status: '健康，已绝育', description: '非常聪明，服从性好，适合有一定养犬经验的家庭。' },
    { name: '咪咪', category: '猫', breed: '橘猫', sex: '公', age: 18, weight: 5.6, health_status: '偏胖，需控制饮食', description: '干饭第一名，性格憨厚，谁都能抱。' },
    { name: '小灰', category: '兔', breed: '侏儒兔', sex: '公', age: 3, weight: 1.1, health_status: '健康', description: '体型小巧，适合公寓饲养。' },
  ];
  const pets = [];
  for (const p of demoPets) {
    pets.push(await petModel.create(p));
  }
  log(`[4/5] 演示宠物 -> ${demoPets.length} 只`);

  const apply = (pet, user, reason, phone, address) => adoptionModel.create({
    petId: pet.id,
    applicantId: user.id,
    reason,
    contactPhone: phone,
    address,
  });

  // 场景一：审核通过 -> 宠物变为「已领养」
  const a1 = await apply(pets[1], users[0], '家里有院子，之前养过金毛，经验充足。', '13800138001', '广州市天河区体育西路');
  await adoptionModel.review({
    id: a1.id, decision: 'approved', reviewRemark: '回访通过，同意领养', reviewerId: admin.id,
  });

  // 场景二：审核拒绝 -> 宠物恢复「待领养」
  const a2 = await apply(pets[4], users[1], '想给孩子找个小伙伴。', '13800138002', '广州市越秀区中山五路');
  await adoptionModel.review({
    id: a2.id, decision: 'rejected', reviewRemark: '家中已有大型犬，暂不适合再养兔', reviewerId: admin.id,
  });

  // 场景三：待审核
  await apply(pets[0], users[0], '独居，想养一只安静的猫作伴。', '13800138001', '广州市天河区体育西路');

  // 场景四：同一只宠物多人申请，仍待审核
  await apply(pets[3], users[1], '家里有两只猫，想再添一只。', '13800138002', '广州市越秀区中山五路');
  await apply(pets[3], users[2], '有五年养猫经验，已备好猫爬架。', '13800138003', '广州市海珠区新港中路');

  const stats = await adoptionModel.stats();
  log(`        演示领养申请 -> 共 ${stats.total} 条 (待审 ${stats.byStatus.pending} / 通过 ${stats.byStatus.approved} / 拒绝 ${stats.byStatus.rejected})`);
  log('[5/5] 完成');
}

(async () => {
  try {
    await createDatabase();
    await seedData();
    const db = require('../db/db');
    await db.close();
    process.exit(0);
  } catch (err) {
    console.error('\n[初始化失败] ' + err.message);
    if (err.code === 'ER_ACCESS_DENIED_ERROR') {
      console.error('数据库账号或密码不正确，请检查 .env 中的 DB_USER / DB_PASSWORD');
    } else if (err.code === 'ECONNREFUSED') {
      console.error('连不上 MySQL，请确认服务已启动，且 DB_HOST / DB_PORT 正确');
    }
    process.exit(1);
  }
})();
