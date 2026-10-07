/**
 * 宠物接口测试
 */
const {
  api, db, createUserAndLogin, adminSession, createPet, uniqueName,
} = require('./helpers');

afterAll(async () => {
  await db.close();
});

describe('权限控制', () => {
  test('未登录新增宠物返回 401', async () => {
    const res = await api().post('/api/pets').send({ name: 'x', category: '猫', sex: '母', age: 1 });
    expect(res.status).toBe(401);
  });

  test('普通用户新增宠物返回 403', async () => {
    const { auth } = await createUserAndLogin();
    const res = await api()
      .post('/api/pets')
      .set('Authorization', auth)
      .send({ name: 'x', category: '猫', sex: '母', age: 1 });
    expect(res.status).toBe(403);
  });

  test('普通用户访问看板统计返回 403', async () => {
    const { auth } = await createUserAndLogin();
    const res = await api().get('/api/pets/stats').set('Authorization', auth);
    expect(res.status).toBe(403);
  });

  test('宠物列表对外公开，无需登录', async () => {
    const res = await api().get('/api/pets');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data.list)).toBe(true);
  });
});

describe('POST /api/pets', () => {
  test('管理员新增宠物成功', async () => {
    const { auth } = await adminSession();
    const name = uniqueName('新增');
    const res = await api()
      .post('/api/pets')
      .set('Authorization', auth)
      .send({
        name, category: '狗', breed: '柴犬', sex: '公', age: 10, weight: 9.5, description: '活泼好动',
      });

    expect(res.status).toBe(200);
    expect(res.body.data.name).toBe(name);
    expect(res.body.data.status).toBe('available');
    expect(res.body.data.statusText).toBe('待领养');
    expect(Number(res.body.data.weight)).toBeCloseTo(9.5);
  });

  test('缺少必填字段返回 400', async () => {
    const { auth } = await adminSession();
    const res = await api()
      .post('/api/pets')
      .set('Authorization', auth)
      .send({ name: '缺字段' });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/不能为空|只能是/);
  });

  test('性别非法返回 400', async () => {
    const { auth } = await adminSession();
    const res = await api()
      .post('/api/pets')
      .set('Authorization', auth)
      .send({ name: 'x', category: '猫', sex: '未知', age: 1 });

    expect(res.status).toBe(400);
  });

  test('年龄超出范围返回 400', async () => {
    const { auth } = await adminSession();
    const res = await api()
      .post('/api/pets')
      .set('Authorization', auth)
      .send({ name: 'x', category: '猫', sex: '母', age: 9999 });

    expect(res.status).toBe(400);
  });
});

describe('GET /api/pets', () => {
  test('分页结构正确且 size 受上限保护', async () => {
    const res = await api().get('/api/pets?page=1&size=3');
    expect(res.status).toBe(200);
    expect(res.body.data.list.length).toBeLessThanOrEqual(3);
    expect(res.body.data.page).toBe(1);
    expect(res.body.data.size).toBe(3);
    expect(typeof res.body.data.pages).toBe('number');

    const huge = await api().get('/api/pets?page=1&size=99999');
    expect(huge.body.data.size).toBe(100);
  });

  test('关键字可匹配名称', async () => {
    const pet = await createPet({ name: uniqueName('搜索目标') });
    const res = await api().get(`/api/pets?keyword=${encodeURIComponent(pet.name)}`);

    expect(res.status).toBe(200);
    expect(res.body.data.list.some((p) => p.id === pet.id)).toBe(true);
  });

  test('按分类筛选', async () => {
    await createPet({ category: '龙猫' });
    const res = await api().get('/api/pets?category=龙猫');

    expect(res.status).toBe(200);
    expect(res.body.data.list.length).toBeGreaterThan(0);
    expect(res.body.data.list.every((p) => p.category === '龙猫')).toBe(true);
  });

  test('默认隐藏已下架宠物，显式指定 status 时可见', async () => {
    const pet = await createPet({ status: 'offline' });

    const hidden = await api().get(`/api/pets?keyword=${encodeURIComponent(pet.name)}`);
    expect(hidden.body.data.list.some((p) => p.id === pet.id)).toBe(false);

    const shown = await api().get(`/api/pets?keyword=${encodeURIComponent(pet.name)}&status=offline`);
    expect(shown.body.data.list.some((p) => p.id === pet.id)).toBe(true);
  });

  test('分类列表接口可用', async () => {
    const res = await api().get('/api/pets/categories');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });
});

describe('GET /api/pets/:id', () => {
  test('返回详情且浏览量自增', async () => {
    const pet = await createPet();
    const first = await api().get(`/api/pets/${pet.id}`);

    expect(first.status).toBe(200);
    expect(first.body.data.id).toBe(pet.id);

    const second = await api().get(`/api/pets/${pet.id}`);
    expect(second.body.data.viewCount).toBe(first.body.data.viewCount + 1);
  });

  test('不存在的宠物返回 404', async () => {
    const res = await api().get('/api/pets/99999999');
    expect(res.status).toBe(404);
  });

  test('ID 非法返回 400', async () => {
    const res = await api().get('/api/pets/abc');
    expect(res.status).toBe(400);
  });
});

describe('PUT /api/pets/:id', () => {
  test('管理员可局部更新字段', async () => {
    const { auth } = await adminSession();
    const pet = await createPet({ name: '旧名字', status: 'available' });

    const res = await api()
      .put(`/api/pets/${pet.id}`)
      .set('Authorization', auth)
      .send({ name: '新名字', status: 'offline' });

    expect(res.status).toBe(200);
    expect(res.body.data.name).toBe('新名字');
    expect(res.body.data.status).toBe('offline');
    expect(res.body.data.category).toBe(pet.category);
  });

  test('更新不存在的宠物返回 404', async () => {
    const { auth } = await adminSession();
    const res = await api().put('/api/pets/99999999').set('Authorization', auth).send({ name: 'x' });
    expect(res.status).toBe(404);
  });
});

describe('DELETE /api/pets/:id', () => {
  test('管理员删除后查询返回 404', async () => {
    const { auth } = await adminSession();
    const pet = await createPet();

    const del = await api().delete(`/api/pets/${pet.id}`).set('Authorization', auth);
    expect(del.status).toBe(200);

    const after = await api().get(`/api/pets/${pet.id}`);
    expect(after.status).toBe(404);
  });
});

describe('GET /api/pets/stats', () => {
  test('管理员可获取看板统计', async () => {
    const { auth } = await adminSession();
    const res = await api().get('/api/pets/stats').set('Authorization', auth);

    expect(res.status).toBe(200);
    expect(res.body.data.byStatus).toHaveProperty('available');
    expect(res.body.data.byStatus).toHaveProperty('adopted');
    expect(Array.isArray(res.body.data.byCategory)).toBe(true);
    expect(Array.isArray(res.body.data.hotPets)).toBe(true);
  });
});
