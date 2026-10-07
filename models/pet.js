/**
 * 宠物模型
 * 状态流转：available(待领养) → pending(审核中) → adopted(已领养)
 *          available ↔ offline(已下架)
 */
const { run, query } = require('../db/db');
const { like } = require('../utils/sql');
const { normalizePagination } = require('../utils/pagination');
const AppError = require('../utils/AppError');

const STATUS = {
  AVAILABLE: 'available',
  PENDING: 'pending',
  ADOPTED: 'adopted',
  OFFLINE: 'offline',
};

const STATUS_TEXT = {
  available: '待领养',
  pending: '审核中',
  adopted: '已领养',
  offline: '已下架',
};

function mapPet(r) {
  if (!r) return null;
  return {
    id: r.id,
    name: r.name,
    category: r.category,
    breed: r.breed,
    sex: r.sex,
    age: r.age,
    weight: r.weight,
    healthStatus: r.health_status,
    description: r.description,
    imageUrl: r.image_url,
    status: r.status,
    statusText: STATUS_TEXT[r.status] || r.status,
    viewCount: r.view_count,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

const WRITABLE_FIELDS = [
  'name', 'category', 'breed', 'sex', 'age',
  'weight', 'health_status', 'description', 'image_url', 'status',
];

async function create(data) {
  // 只写入调用方显式提供的字段，未提供的交给数据库默认值处理
  // （否则把 undefined 传成 NULL 会覆盖 status 等列的 NOT NULL DEFAULT）
  const fields = [];
  const values = [];
  for (const f of WRITABLE_FIELDS) {
    if (data[f] !== undefined) {
      fields.push(f);
      values.push(data[f]);
    }
  }
  if (fields.length === 0) {
    throw new AppError('缺少宠物信息', 400);
  }

  const placeholders = fields.map(() => '?').join(', ');
  const res = await query(
    `INSERT INTO pets (${fields.join(', ')}) VALUES (${placeholders})`,
    values
  );
  return findById(res.insertId);
}

async function findById(id, conn = null) {
  const rows = await run(conn, 'SELECT * FROM pets WHERE id = ?', [id]);
  return mapPet(rows[0]);
}

/** 取原始行，审核时加行锁以防并发重复审核 */
async function findRawForUpdate(id, conn) {
  const rows = await run(conn, 'SELECT * FROM pets WHERE id = ? FOR UPDATE', [id]);
  return rows[0] || null;
}

async function update(id, data) {
  const fields = [];
  const params = [];
  for (const f of WRITABLE_FIELDS) {
    if (data[f] !== undefined) {
      fields.push(`${f} = ?`);
      params.push(data[f]);
    }
  }
  if (fields.length === 0) return findById(id);

  params.push(id);
  await query(`UPDATE pets SET ${fields.join(', ')} WHERE id = ?`, params);
  return findById(id);
}

async function remove(id) {
  const pet = await findById(id);
  if (!pet) throw new AppError('宠物记录不存在', 404);
  await query('DELETE FROM pets WHERE id = ?', [id]);
  return { id: Number(id) };
}

/**
 * 分页查询宠物列表。
 * excludeOffline 为 true 时隐藏已下架的宠物（面向普通用户）。
 */
async function list({ page, size, keyword, category, sex, status, excludeOffline }) {
  const { page: p, size: s, offset } = normalizePagination(page, size);

  const clauses = [];
  const params = [];
  if (keyword) {
    clauses.push('(name LIKE ? OR breed LIKE ? OR description LIKE ?)');
    params.push(like(keyword), like(keyword), like(keyword));
  }
  if (category) {
    clauses.push('category = ?');
    params.push(category);
  }
  if (sex) {
    clauses.push('sex = ?');
    params.push(sex);
  }
  if (status) {
    clauses.push('status = ?');
    params.push(status);
  } else if (excludeOffline) {
    clauses.push("status <> 'offline'");
  }
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';

  const countRows = await query(`SELECT COUNT(*) AS total FROM pets ${where}`, params);
  const total = countRows[0].total;

  const rows = await query(
    `SELECT * FROM pets ${where} ORDER BY id DESC LIMIT ${s} OFFSET ${offset}`,
    params
  );

  return { list: rows.map(mapPet), total, page: p, size: s };
}

async function setStatus(conn, id, status) {
  await run(conn, 'UPDATE pets SET status = ? WHERE id = ?', [status, id]);
}

async function incrementView(id) {
  await query('UPDATE pets SET view_count = view_count + 1 WHERE id = ?', [id]);
}

async function categories() {
  const rows = await query('SELECT DISTINCT category FROM pets ORDER BY category');
  return rows.map((r) => r.category);
}

/** 看板统计 */
async function stats() {
  const statusRows = await query('SELECT status, COUNT(*) AS c FROM pets GROUP BY status');
  const byStatus = { available: 0, pending: 0, adopted: 0, offline: 0 };
  statusRows.forEach((r) => {
    byStatus[r.status] = Number(r.c);
  });

  const catRows = await query(
    'SELECT category, COUNT(*) AS c FROM pets GROUP BY category ORDER BY c DESC LIMIT 8'
  );

  const totalRows = await query(
    `SELECT COUNT(*) AS total,
            SUM(DATE(created_at) = CURDATE()) AS todayNew,
            SUM(created_at >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)) AS weekNew
     FROM pets`
  );
  const t = totalRows[0] || {};

  const rankRows = await query(
    'SELECT id, name, category, view_count FROM pets ORDER BY view_count DESC LIMIT 5'
  );

  return {
    total: Number(t.total || 0),
    todayNew: Number(t.todayNew || 0),
    weekNew: Number(t.weekNew || 0),
    byStatus,
    byCategory: catRows.map((r) => ({ category: r.category, count: Number(r.c) })),
    hotPets: rankRows.map((r) => ({
      id: r.id,
      name: r.name,
      category: r.category,
      viewCount: r.view_count,
    })),
  };
}

module.exports = {
  STATUS,
  STATUS_TEXT,
  create,
  findById,
  findRawForUpdate,
  update,
  remove,
  list,
  setStatus,
  incrementView,
  categories,
  stats,
};
