/**
 * 领养申请模型
 * 这是本系统的核心业务模块：申请 → 审核 → 状态流转。
 * 所有涉及多表写入的操作都放在事务里，避免出现「申请通过了但宠物状态没变」这类脏数据。
 */
const { run, query, transaction } = require('../db/db');
const { like } = require('../utils/sql');
const { normalizePagination } = require('../utils/pagination');
const AppError = require('../utils/AppError');
const petModel = require('./pet');

const STATUS = {
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  CANCELLED: 'cancelled',
};

const STATUS_TEXT = {
  pending: '待审核',
  approved: '已通过',
  rejected: '已拒绝',
  cancelled: '已撤销',
};

function mapAdoption(r) {
  if (!r) return null;
  return {
    id: r.id,
    petId: r.pet_id,
    applicantId: r.applicant_id,
    reason: r.reason,
    contactPhone: r.contact_phone,
    address: r.address,
    status: r.status,
    statusText: STATUS_TEXT[r.status] || r.status,
    reviewRemark: r.review_remark,
    reviewedBy: r.reviewed_by,
    reviewedAt: r.reviewed_at,
    createdAt: r.created_at,
    petName: r.pet_name,
    petCategory: r.pet_category,
    petImageUrl: r.pet_image_url,
    petStatus: r.pet_status,
    applicantName: r.applicant_name,
    applicantUsername: r.applicant_username,
    reviewerName: r.reviewer_name,
  };
}

const SELECT_WITH_JOIN = `
  SELECT a.*,
         p.name AS pet_name, p.category AS pet_category,
         p.image_url AS pet_image_url, p.status AS pet_status,
         u.nickname AS applicant_name, u.username AS applicant_username,
         r.nickname AS reviewer_name
  FROM adoptions a
  JOIN pets p ON p.id = a.pet_id
  JOIN users u ON u.id = a.applicant_id
  LEFT JOIN users r ON r.id = a.reviewed_by
`;

async function findById(id, conn = null) {
  const rows = await run(conn, `${SELECT_WITH_JOIN} WHERE a.id = ?`, [id]);
  return mapAdoption(rows[0]);
}

/**
 * 提交领养申请。
 * 事务内：校验宠物状态 → 防重复申请 → 写申请单 → 宠物置为「审核中」
 */
async function create({ petId, applicantId, reason, contactPhone, address }) {
  return transaction(async (conn) => {
    const pet = await petModel.findRawForUpdate(petId, conn);
    if (!pet) throw new AppError('宠物不存在', 404);
    if (pet.status === petModel.STATUS.ADOPTED) {
      throw new AppError('该宠物已被领养，无法申请', 400);
    }
    if (pet.status === petModel.STATUS.OFFLINE) {
      throw new AppError('该宠物已下架，无法申请', 400);
    }

    const dup = await run(
      conn,
      "SELECT id FROM adoptions WHERE pet_id = ? AND applicant_id = ? AND status IN ('pending','approved')",
      [petId, applicantId]
    );
    if (dup.length > 0) {
      throw new AppError('你已提交过该宠物的领养申请，请勿重复提交', 409);
    }

    const res = await run(
      conn,
      'INSERT INTO adoptions (pet_id, applicant_id, reason, contact_phone, address) VALUES (?, ?, ?, ?, ?)',
      [petId, applicantId, reason, contactPhone, address]
    );

    await run(
      conn,
      "UPDATE pets SET status = ? WHERE id = ? AND status = ?",
      [petModel.STATUS.PENDING, petId, petModel.STATUS.AVAILABLE]
    );

    return res.insertId;
  }).then((id) => findById(id));
}

/** 我的申请列表 */
async function listByApplicant(applicantId, { page, size, status }) {
  const { page: p, size: s, offset } = normalizePagination(page, size);
  const clauses = ['a.applicant_id = ?'];
  const params = [applicantId];
  if (status) {
    clauses.push('a.status = ?');
    params.push(status);
  }
  const where = `WHERE ${clauses.join(' AND ')}`;

  const countRows = await query(
    `SELECT COUNT(*) AS total FROM adoptions a ${where}`,
    params
  );
  const total = countRows[0].total;

  const rows = await query(
    `${SELECT_WITH_JOIN} ${where} ORDER BY a.id DESC LIMIT ${s} OFFSET ${offset}`,
    params
  );
  return { list: rows.map(mapAdoption), total, page: p, size: s };
}

/** 管理员分页查询全部申请 */
async function list({ page, size, status, keyword }) {
  const { page: p, size: s, offset } = normalizePagination(page, size);
  const clauses = [];
  const params = [];
  if (status) {
    clauses.push('a.status = ?');
    params.push(status);
  }
  if (keyword) {
    clauses.push('(p.name LIKE ? OR u.username LIKE ? OR u.nickname LIKE ?)');
    params.push(like(keyword), like(keyword), like(keyword));
  }
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';

  const countRows = await query(
    `SELECT COUNT(*) AS total FROM adoptions a
       JOIN pets p ON p.id = a.pet_id
       JOIN users u ON u.id = a.applicant_id ${where}`,
    params
  );
  const total = countRows[0].total;

  const rows = await query(
    `${SELECT_WITH_JOIN} ${where} ORDER BY FIELD(a.status,'pending','approved','rejected','cancelled'), a.id DESC
     LIMIT ${s} OFFSET ${offset}`,
    params
  );
  return { list: rows.map(mapAdoption), total, page: p, size: s };
}

/**
 * 审核领养申请。
 * 通过 → 宠物置为已领养，同一宠物的其它待审申请自动拒绝
 * 拒绝 → 若该宠物已无待审申请，恢复为待领养
 */
async function review({ id, decision, reviewRemark, reviewerId }) {
  if (!['approved', 'rejected'].includes(decision)) {
    throw new AppError('审核结果只能是 approved 或 rejected', 400);
  }

  await transaction(async (conn) => {
    const rows = await run(conn, 'SELECT * FROM adoptions WHERE id = ? FOR UPDATE', [id]);
    const adoption = rows[0];
    if (!adoption) throw new AppError('领养申请不存在', 404);
    if (adoption.status !== STATUS.PENDING) {
      throw new AppError('该申请已处理，不能重复审核', 409);
    }

    const pet = await petModel.findRawForUpdate(adoption.pet_id, conn);
    if (!pet) throw new AppError('宠物不存在', 404);

    if (decision === 'approved') {
      if (pet.status === petModel.STATUS.ADOPTED) {
        throw new AppError('该宠物已被领养', 409);
      }

      await run(
        conn,
        'UPDATE adoptions SET status = ?, review_remark = ?, reviewed_by = ?, reviewed_at = NOW() WHERE id = ?',
        [STATUS.APPROVED, reviewRemark || '恭喜，领养申请已通过', reviewerId, id]
      );

      const others = await run(
        conn,
        "UPDATE adoptions SET status = ?, review_remark = '该宠物已被他人领养', reviewed_by = ?, reviewed_at = NOW() WHERE pet_id = ? AND id <> ? AND status = 'pending'",
        [STATUS.REJECTED, reviewerId, adoption.pet_id, id]
      );

      await petModel.setStatus(conn, adoption.pet_id, petModel.STATUS.ADOPTED);
      return others;
    }

    await run(
      conn,
      'UPDATE adoptions SET status = ?, review_remark = ?, reviewed_by = ?, reviewed_at = NOW() WHERE id = ?',
      [STATUS.REJECTED, reviewRemark || '很抱歉，本次申请未通过', reviewerId, id]
    );

    const remain = await run(
      conn,
      "SELECT COUNT(*) AS c FROM adoptions WHERE pet_id = ? AND status = 'pending'",
      [adoption.pet_id]
    );
    if (Number(remain[0].c) === 0) {
      await run(
        conn,
        'UPDATE pets SET status = ? WHERE id = ? AND status = ?',
        [petModel.STATUS.AVAILABLE, adoption.pet_id, petModel.STATUS.PENDING]
      );
    }
    return null;
  });

  return findById(id);
}

/** 申请人撤销自己的待审申请 */
async function cancel(id, applicantId) {
  await transaction(async (conn) => {
    const rows = await run(conn, 'SELECT * FROM adoptions WHERE id = ? FOR UPDATE', [id]);
    const adoption = rows[0];
    if (!adoption) throw new AppError('领养申请不存在', 404);
    if (Number(adoption.applicant_id) !== Number(applicantId)) {
      throw new AppError('只能撤销自己提交的申请', 403);
    }
    if (adoption.status !== STATUS.PENDING) {
      throw new AppError('只能撤销待审核的申请', 400);
    }

    await run(conn, 'UPDATE adoptions SET status = ? WHERE id = ?', [STATUS.CANCELLED, id]);

    const remain = await run(
      conn,
      "SELECT COUNT(*) AS c FROM adoptions WHERE pet_id = ? AND status = 'pending'",
      [adoption.pet_id]
    );
    if (Number(remain[0].c) === 0) {
      await run(
        conn,
        'UPDATE pets SET status = ? WHERE id = ? AND status = ?',
        [petModel.STATUS.AVAILABLE, adoption.pet_id, petModel.STATUS.PENDING]
      );
    }
  });

  return findById(id);
}

/** 看板统计：状态分布 + 近 7 天申请趋势 */
async function stats() {
  const statusRows = await query('SELECT status, COUNT(*) AS c FROM adoptions GROUP BY status');
  const byStatus = { pending: 0, approved: 0, rejected: 0, cancelled: 0 };
  statusRows.forEach((r) => {
    byStatus[r.status] = Number(r.c);
  });

  const totalRows = await query(
    `SELECT COUNT(*) AS total,
            SUM(DATE(created_at) = CURDATE()) AS todayNew
     FROM adoptions`
  );
  const t = totalRows[0] || {};

  const trendRows = await query(
    `SELECT DATE_FORMAT(created_at, '%Y-%m-%d') AS d, COUNT(*) AS c
     FROM adoptions
     WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 6 DAY)
     GROUP BY d`
  );
  const map = {};
  trendRows.forEach((r) => {
    map[String(r.d).slice(0, 10)] = Number(r.c);
  });

  const trend = [];
  for (let i = 6; i >= 0; i -= 1) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    trend.push({ date: key, count: map[key] || 0 });
  }

  const total = Number(t.total || 0);
  const approved = byStatus.approved;

  return {
    total,
    todayNew: Number(t.todayNew || 0),
    byStatus,
    approveRate: total > 0 ? Number(((approved / total) * 100).toFixed(1)) : 0,
    trend,
  };
}

module.exports = {
  STATUS,
  create,
  findById,
  listByApplicant,
  list,
  review,
  cancel,
  stats,
};
