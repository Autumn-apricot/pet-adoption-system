/** 状态字典与展示辅助 —— 与后端 models 中的枚举保持一致 */

export const PET_STATUS = {
  available: { text: '待领养', type: 'success' },
  pending: { text: '审核中', type: 'warning' },
  adopted: { text: '已领养', type: 'info' },
  offline: { text: '已下架', type: 'danger' },
};

export const ADOPTION_STATUS = {
  pending: { text: '待审核', type: 'warning' },
  approved: { text: '已通过', type: 'success' },
  rejected: { text: '已拒绝', type: 'danger' },
  cancelled: { text: '已撤销', type: 'info' },
};

export const USER_STATUS = {
  1: { text: '正常', type: 'success' },
  0: { text: '已禁用', type: 'danger' },
};

export const SEX_OPTIONS = ['公', '母'];

const CATEGORY_EMOJI = {
  猫: '🐱',
  狗: '🐶',
  兔: '🐰',
  鸟: '🐦',
  仓鼠: '🐹',
  龟: '🐢',
  蛇: '🐍',
  鱼: '🐠',
};

export function petStatus(status) {
  return PET_STATUS[status] || { text: status || '未知', type: 'info' };
}

export function adoptionStatus(status) {
  return ADOPTION_STATUS[status] || { text: status || '未知', type: 'info' };
}

export function userStatus(status) {
  return USER_STATUS[Number(status)] || { text: '未知', type: 'info' };
}

export function emojiOf(category) {
  return CATEGORY_EMOJI[category] || '🐾';
}

/** 年龄字段单位为「月」，超过 12 个月按岁展示更直观 */
export function formatAge(months) {
  const m = Number(months);
  if (!Number.isFinite(m)) return '-';
  if (m < 12) return `${m} 个月`;
  return `${(m / 12).toFixed(m % 12 === 0 ? 0 : 1)} 岁`;
}

export function formatDate(value) {
  if (!value) return '-';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value).slice(0, 10);
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}
