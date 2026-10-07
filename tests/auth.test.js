/**
 * 认证与用户管理接口测试
 */
const {
  api, db, createUserAndLogin, adminSession, uniqueName,
} = require('./helpers');

afterAll(async () => {
  await db.close();
});

describe('POST /api/auth/register', () => {
  test('注册成功，返回用户信息但不包含密码', async () => {
    const username = uniqueName('reg');
    const res = await api()
      .post('/api/auth/register')
      .send({ username, password: '123456', nickname: '新用户' });

    expect(res.status).toBe(200);
    expect(res.body.code).toBe(200);
    expect(res.body.data.username).toBe(username);
    expect(res.body.data.role).toBe('user');
    expect(res.body.data).not.toHaveProperty('password');
    expect(res.body.data).not.toHaveProperty('password_hash');
  });

  test('用户名重复返回 409', async () => {
    const username = uniqueName('dup');
    await api().post('/api/auth/register').send({ username, password: '123456' });
    const res = await api().post('/api/auth/register').send({ username, password: '123456' });

    expect(res.status).toBe(409);
    expect(res.body.message).toMatch(/已存在/);
  });

  test('密码过短返回 400', async () => {
    const res = await api()
      .post('/api/auth/register')
      .send({ username: uniqueName('short'), password: '123' });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/密码长度/);
  });

  test('用户名含非法字符返回 400', async () => {
    const res = await api()
      .post('/api/auth/register')
      .send({ username: 'bad name!', password: '123456' });

    expect(res.status).toBe(400);
  });
});

describe('POST /api/auth/login', () => {
  test('登录成功返回 JWT', async () => {
    const { username, password } = await createUserAndLogin();
    const res = await api().post('/api/auth/login').send({ username, password });

    expect(res.status).toBe(200);
    expect(typeof res.body.data.token).toBe('string');
    expect(res.body.data.token.split('.')).toHaveLength(3);
  });

  test('密码错误与用户不存在返回同一提示，避免账号枚举', async () => {
    const { username } = await createUserAndLogin();

    const wrongPwd = await api().post('/api/auth/login').send({ username, password: 'wrong-password' });
    const noUser = await api().post('/api/auth/login').send({ username: 'no_such_user_xyz', password: '123456' });

    expect(wrongPwd.status).toBe(400);
    expect(noUser.status).toBe(400);
    expect(wrongPwd.body.message).toBe(noUser.body.message);
  });

  test('账号被禁用后无法登录', async () => {
    const { user, username, password } = await createUserAndLogin();
    const { auth } = await adminSession();

    await api().put(`/api/users/${user.id}/status`).set('Authorization', auth).send({ status: 0 });

    const res = await api().post('/api/auth/login').send({ username, password });
    expect(res.status).toBe(403);
    expect(res.body.message).toMatch(/禁用/);
  });
});

describe('GET /api/auth/profile', () => {
  test('缺少 token 返回 401', async () => {
    const res = await api().get('/api/auth/profile');
    expect(res.status).toBe(401);
  });

  test('token 非法返回 401', async () => {
    const res = await api().get('/api/auth/profile').set('Authorization', 'Bearer not-a-token');
    expect(res.status).toBe(401);
  });

  test('携带有效 token 返回自己的资料', async () => {
    const { user, auth } = await createUserAndLogin({ nickname: '测试昵称' });
    const res = await api().get('/api/auth/profile').set('Authorization', auth);

    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(user.id);
    expect(res.body.data.nickname).toBe('测试昵称');
  });
});

describe('PUT /api/auth/profile', () => {
  test('可以修改昵称与手机号', async () => {
    const { auth } = await createUserAndLogin();
    const res = await api()
      .put('/api/auth/profile')
      .set('Authorization', auth)
      .send({ nickname: '改过的昵称', phone: '13800138000' });

    expect(res.status).toBe(200);
    expect(res.body.data.nickname).toBe('改过的昵称');
    expect(res.body.data.phone).toBe('13800138000');
  });

  test('手机号格式错误返回 400', async () => {
    const { auth } = await createUserAndLogin();
    const res = await api()
      .put('/api/auth/profile')
      .set('Authorization', auth)
      .send({ phone: '123' });

    expect(res.status).toBe(400);
  });
});

describe('PUT /api/auth/password', () => {
  test('原密码错误返回 400', async () => {
    const { auth } = await createUserAndLogin();
    const res = await api()
      .put('/api/auth/password')
      .set('Authorization', auth)
      .send({ oldPassword: 'wrong', newPassword: 'newpass123' });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/原密码/);
  });

  test('改密成功后必须用新密码登录', async () => {
    const { username, auth } = await createUserAndLogin();

    const change = await api()
      .put('/api/auth/password')
      .set('Authorization', auth)
      .send({ oldPassword: '123456', newPassword: 'newpass123' });
    expect(change.status).toBe(200);

    const oldLogin = await api().post('/api/auth/login').send({ username, password: '123456' });
    expect(oldLogin.status).toBe(400);

    const newLogin = await api().post('/api/auth/login').send({ username, password: 'newpass123' });
    expect(newLogin.status).toBe(200);
  });
});

describe('用户管理（管理员）', () => {
  test('普通用户访问用户列表返回 403', async () => {
    const { auth } = await createUserAndLogin();
    const res = await api().get('/api/users').set('Authorization', auth);
    expect(res.status).toBe(403);
  });

  test('管理员可分页查询用户', async () => {
    const { auth } = await adminSession();
    const res = await api().get('/api/users?page=1&size=5').set('Authorization', auth);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data.list)).toBe(true);
    expect(res.body.data.page).toBe(1);
    expect(res.body.data.size).toBe(5);
    expect(typeof res.body.data.total).toBe('number');
  });

  test('关键字搜索按用户名或昵称匹配', async () => {
    const { auth } = await adminSession();
    const { user } = await createUserAndLogin();
    const res = await api()
      .get(`/api/users?keyword=${encodeURIComponent(user.username)}`)
      .set('Authorization', auth);

    expect(res.status).toBe(200);
    expect(res.body.data.list.some((u) => u.username === user.username)).toBe(true);
  });

  test('管理员不能删除自己', async () => {
    const { auth } = await adminSession();
    const me = await api().get('/api/auth/profile').set('Authorization', auth);

    const res = await api().delete(`/api/users/${me.body.data.id}`).set('Authorization', auth);
    expect(res.status).toBe(400);
  });

  test('不能禁用管理员账号', async () => {
    const { auth } = await adminSession();
    const me = await api().get('/api/auth/profile').set('Authorization', auth);

    const res = await api()
      .put(`/api/users/${me.body.data.id}/status`)
      .set('Authorization', auth)
      .send({ status: 0 });
    expect(res.status).toBe(400);
  });
});
