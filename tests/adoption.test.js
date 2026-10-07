/**
 * 领养申请与审核流程测试（核心业务）
 */
const {
  api, db, createUserAndLogin, adminSession, createPet,
} = require('./helpers');

afterAll(async () => {
  await db.close();
});

function application(petId, overrides = {}) {
  return {
    petId,
    reason: '我家有院子，有五年养宠经验，可以提供稳定的生活环境。',
    contactPhone: '13800138000',
    address: '广州市天河区体育西路 100 号',
    ...overrides,
  };
}

describe('POST /api/adoptions', () => {
  test('提交申请成功，宠物状态变为「审核中」', async () => {
    const { auth } = await createUserAndLogin();
    const pet = await createPet();

    const res = await api().post('/api/adoptions').set('Authorization', auth).send(application(pet.id));
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('pending');
    expect(res.body.data.petId).toBe(pet.id);

    const after = await api().get(`/api/pets/${pet.id}`);
    expect(after.body.data.status).toBe('pending');
    expect(after.body.data.statusText).toBe('审核中');
  });

  test('同一用户重复申请同一宠物返回 409', async () => {
    const { auth } = await createUserAndLogin();
    const pet = await createPet();

    await api().post('/api/adoptions').set('Authorization', auth).send(application(pet.id));
    const second = await api().post('/api/adoptions').set('Authorization', auth).send(application(pet.id));

    expect(second.status).toBe(409);
    expect(second.body.message).toMatch(/重复/);
  });

  test('已领养的宠物不可申请', async () => {
    const { auth } = await createUserAndLogin();
    const pet = await createPet({ status: 'adopted' });

    const res = await api().post('/api/adoptions').set('Authorization', auth).send(application(pet.id));
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/已被领养/);
  });

  test('已下架的宠物不可申请', async () => {
    const { auth } = await createUserAndLogin();
    const pet = await createPet({ status: 'offline' });

    const res = await api().post('/api/adoptions').set('Authorization', auth).send(application(pet.id));
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/已下架/);
  });

  test('宠物不存在返回 404', async () => {
    const { auth } = await createUserAndLogin();
    const res = await api().post('/api/adoptions').set('Authorization', auth).send(application(99999999));
    expect(res.status).toBe(404);
  });

  test('参数校验：理由为空 / 手机号格式错误返回 400', async () => {
    const { auth } = await createUserAndLogin();
    const pet = await createPet();

    const emptyReason = await api()
      .post('/api/adoptions')
      .set('Authorization', auth)
      .send(application(pet.id, { reason: '' }));
    expect(emptyReason.status).toBe(400);

    const badPhone = await api()
      .post('/api/adoptions')
      .set('Authorization', auth)
      .send(application(pet.id, { contactPhone: '123' }));
    expect(badPhone.status).toBe(400);
  });

  test('未登录不能提交申请', async () => {
    const pet = await createPet();
    const res = await api().post('/api/adoptions').send(application(pet.id));
    expect(res.status).toBe(401);
  });
});

describe('GET /api/adoptions/mine', () => {
  test('只返回自己的申请', async () => {
    const a = await createUserAndLogin();
    const b = await createUserAndLogin();
    const pet = await createPet();

    await api().post('/api/adoptions').set('Authorization', b.auth).send(application(pet.id));

    const mine = await api().get('/api/adoptions/mine').set('Authorization', a.auth);
    expect(mine.status).toBe(200);
    expect(mine.body.data.list.every((x) => x.applicantId === a.user.id)).toBe(true);
    expect(mine.body.data.list.some((x) => x.petId === pet.id)).toBe(false);
  });

  test('可按状态筛选', async () => {
    const { auth } = await createUserAndLogin();
    const pet = await createPet();
    await api().post('/api/adoptions').set('Authorization', auth).send(application(pet.id));

    const res = await api().get('/api/adoptions/mine?status=pending').set('Authorization', auth);
    expect(res.status).toBe(200);
    expect(res.body.data.list.every((x) => x.status === 'pending')).toBe(true);
  });
});

describe('GET /api/adoptions（管理员）', () => {
  test('普通用户访问返回 403', async () => {
    const { auth } = await createUserAndLogin();
    const res = await api().get('/api/adoptions').set('Authorization', auth);
    expect(res.status).toBe(403);
  });

  test('管理员可分页查看全部申请，并带出宠物与申请人信息', async () => {
    const user = await createUserAndLogin();
    const pet = await createPet();
    await api().post('/api/adoptions').set('Authorization', user.auth).send(application(pet.id));

    const { auth } = await adminSession();
    const res = await api().get('/api/adoptions?page=1&size=50').set('Authorization', auth);

    expect(res.status).toBe(200);
    const target = res.body.data.list.find((x) => x.petId === pet.id);
    expect(target).toBeDefined();
    expect(target.petName).toBe(pet.name);
    expect(target.applicantUsername).toBe(user.username);
  });
});

describe('PUT /api/adoptions/:id/review', () => {
  test('审核通过：宠物变已领养，同宠物其它待审申请自动拒绝', async () => {
    const first = await createUserAndLogin();
    const second = await createUserAndLogin();
    const pet = await createPet();

    const app1 = await api().post('/api/adoptions').set('Authorization', first.auth).send(application(pet.id));
    const app2 = await api().post('/api/adoptions').set('Authorization', second.auth).send(application(pet.id));

    const { auth } = await adminSession();
    const review = await api()
      .put(`/api/adoptions/${app1.body.data.id}/review`)
      .set('Authorization', auth)
      .send({ decision: 'approved', reviewRemark: '条件合适，同意领养' });

    expect(review.status).toBe(200);
    expect(review.body.data.status).toBe('approved');
    expect(review.body.data.reviewedAt).toBeTruthy();

    const petAfter = await api().get(`/api/pets/${pet.id}`);
    expect(petAfter.body.data.status).toBe('adopted');

    const others = await api().get('/api/adoptions/mine').set('Authorization', second.auth);
    const other = others.body.data.list.find((x) => x.id === app2.body.data.id);
    expect(other.status).toBe('rejected');
    expect(other.reviewRemark).toMatch(/已被他人领养/);
  });

  test('审核拒绝：宠物恢复「待领养」', async () => {
    const user = await createUserAndLogin();
    const pet = await createPet();

    const app = await api().post('/api/adoptions').set('Authorization', user.auth).send(application(pet.id));
    const { auth } = await adminSession();

    const review = await api()
      .put(`/api/adoptions/${app.body.data.id}/review`)
      .set('Authorization', auth)
      .send({ decision: 'rejected', reviewRemark: '居住条件暂不符合' });

    expect(review.status).toBe(200);
    expect(review.body.data.status).toBe('rejected');

    const petAfter = await api().get(`/api/pets/${pet.id}`);
    expect(petAfter.body.data.status).toBe('available');
  });

  test('同一申请不能重复审核', async () => {
    const user = await createUserAndLogin();
    const pet = await createPet();
    const app = await api().post('/api/adoptions').set('Authorization', user.auth).send(application(pet.id));

    const { auth } = await adminSession();
    await api().put(`/api/adoptions/${app.body.data.id}/review`).set('Authorization', auth).send({ decision: 'approved' });

    const again = await api()
      .put(`/api/adoptions/${app.body.data.id}/review`)
      .set('Authorization', auth)
      .send({ decision: 'rejected' });

    expect(again.status).toBe(409);
    expect(again.body.message).toMatch(/已处理/);
  });

  test('普通用户不能审核', async () => {
    const user = await createUserAndLogin();
    const pet = await createPet();
    const app = await api().post('/api/adoptions').set('Authorization', user.auth).send(application(pet.id));

    const res = await api()
      .put(`/api/adoptions/${app.body.data.id}/review`)
      .set('Authorization', user.auth)
      .send({ decision: 'approved' });

    expect(res.status).toBe(403);
  });

  test('decision 取值非法返回 400', async () => {
    const user = await createUserAndLogin();
    const pet = await createPet();
    const app = await api().post('/api/adoptions').set('Authorization', user.auth).send(application(pet.id));

    const { auth } = await adminSession();
    const res = await api()
      .put(`/api/adoptions/${app.body.data.id}/review`)
      .set('Authorization', auth)
      .send({ decision: 'maybe' });

    expect(res.status).toBe(400);
  });
});

describe('DELETE /api/adoptions/:id（撤销申请）', () => {
  test('申请人可撤销自己的待审申请，宠物恢复待领养', async () => {
    const user = await createUserAndLogin();
    const pet = await createPet();
    const app = await api().post('/api/adoptions').set('Authorization', user.auth).send(application(pet.id));

    const res = await api().delete(`/api/adoptions/${app.body.data.id}`).set('Authorization', user.auth);
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('cancelled');

    const petAfter = await api().get(`/api/pets/${pet.id}`);
    expect(petAfter.body.data.status).toBe('available');
  });

  test('不能撤销他人的申请', async () => {
    const owner = await createUserAndLogin();
    const other = await createUserAndLogin();
    const pet = await createPet();
    const app = await api().post('/api/adoptions').set('Authorization', owner.auth).send(application(pet.id));

    const res = await api().delete(`/api/adoptions/${app.body.data.id}`).set('Authorization', other.auth);
    expect(res.status).toBe(403);
  });
});

describe('GET /api/adoptions/stats', () => {
  test('管理员可获取领养统计与近 7 天趋势', async () => {
    const { auth } = await adminSession();
    const res = await api().get('/api/adoptions/stats').set('Authorization', auth);

    expect(res.status).toBe(200);
    expect(res.body.data.byStatus).toHaveProperty('pending');
    expect(res.body.data).toHaveProperty('approveRate');
    expect(res.body.data.trend).toHaveLength(7);
  });

  test('普通用户访问返回 403', async () => {
    const { auth } = await createUserAndLogin();
    const res = await api().get('/api/adoptions/stats').set('Authorization', auth);
    expect(res.status).toBe(403);
  });
});

describe('GET /health', () => {
  test('健康检查可用', async () => {
    const res = await api().get('/health');
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('up');
  });
});
