# 宠物领养管理系统 — 设计文档

> 版本：v2.0　|　最后更新：2026/10/07
>
> 本文档记录**设计取舍与理由**（为什么这样做）。使用方式、接口清单、快速启动请看 [README.md](README.md)。

---

## 一、设计目标

v1.0 是一个「能跑通」的课程作业：两张表、两个路由文件，宠物只有增删查，用户只有注册登录。它的问题不在功能少，而在于**业务不完整、并发不安全、没有测试**。

v2.0 的目标是三条：

1. **把业务闭环补上** —— 领养不是「宠物表加个字段」，而是一条有状态、有并发、要回滚的流程。
2. **让关键路径经得起推敲** —— 重复申请、并发审核、脏数据，这些是真实系统一定会遇到、也一定是面试会问的点。
3. **让改动可验证** —— 没有测试的重构只是「看起来更整齐」，需要有可重复执行的证据。

明确不做的：不引入 TypeScript、不引入 ORM、不拆微服务。这是单人项目，`mysql2` + 手写 SQL 足够，也能把 SQL 能力展示得更清楚（ORM 会把它藏起来）。

---

## 二、分层设计

```
请求 → 中间件 → 路由 → 校验 → 模型 → 数据库
                ↓                  ↑
             统一响应          事务边界
                ↓
           统一错误处理
```

| 层 | 目录 | 只做这些 | 绝对不做这些 |
| --- | --- | --- | --- |
| 中间件 | `middleware/` | 鉴权判定、错误翻译 | 业务逻辑 |
| 路由 | `router/` | 取参、声明校验链、调模型、组装响应 | 写 SQL、开事务 |
| 模型 | `models/` | SQL、事务、状态流转规则、数据映射 | 接触 `req` / `res` |
| 工具 | `utils/` | 无状态纯函数 | 访问数据库、抛业务语义错误的判断 |
| 配置 | `config/` | 读环境变量、给默认值、启动期强校验 | 运行期动态变更 |

**为什么"路由里不许写 SQL"？**

v1.0 的问题就在这里：`router/pet.js` 里既有 SQL 又有 `res.json`，改一个字段要翻三层。v2.0 把 SQL 全部收进 `models/`，带来两个直接收益：

- 事务边界清晰。`adoption` 的审核逻辑要同时动 `adoptions` 和 `pets` 两张表，放在一个 `transaction(handler)` 里就完成，路由完全不需要知道"这是个事务"。
- 权限规则无法绕过。「不能删除管理员」「不能删除自己」写在 `models/user.js`，任何调用方（包括未来的定时任务、CLI 脚本）都绕不过去。如果写在路由里，第二个入口就漏了。

---

## 三、数据库设计

### 3.1 表结构

三张表，`adoptions` 是核心。

**users**

| 字段 | 类型 | 约束 | 说明 |
| --- | --- | --- | --- |
| `id` | INT UNSIGNED AUTO_INCREMENT | PK | |
| `username` | VARCHAR(20) | UNIQUE, NOT NULL | 登录名 |
| `password_hash` | VARCHAR(60) | NOT NULL | bcrypt 哈希，长度对齐 bcrypt 定长 60 |
| `nickname` | VARCHAR(20) | | 展示名，默认取 username |
| `phone` | VARCHAR(20) | | |
| `role` | ENUM('user','admin') | DEFAULT 'user' | 用 ENUM 而非外键表：角色是固定枚举，不值得多一次 JOIN |
| `status` | TINYINT | DEFAULT 1 | 1 正常 / 0 禁用 |
| `created_at` / `updated_at` | DATETIME | | |

**pets**

| 字段 | 类型 | 约束 | 说明 |
| --- | --- | --- | --- |
| `name` | VARCHAR(50) | NOT NULL | |
| `category` | VARCHAR(30) | NOT NULL | 猫/狗/兔…，用字符串而非字典表：分类会随业务自然增长，管理员应能直接新增 |
| `sex` | ENUM('公','母') | NOT NULL | |
| `age` | INT | NOT NULL | **单位统一为「月」**，避免"1 岁 / 12 个月"混用导致排序错乱，展示层再换算 |
| `weight` | DECIMAL(5,2) | | 用 DECIMAL 不用 FLOAT，重量不需要浮点精度也不该有浮点误差 |
| `health_status` | VARCHAR(30) | | 如"已驱虫、已绝育" |
| `status` | ENUM('available','pending','adopted','offline') | DEFAULT 'available' | 核心状态字段 |
| `view_count` | INT UNSIGNED | DEFAULT 0 | |

**adoptions**

| 字段 | 类型 | 约束 | 说明 |
| --- | --- | --- | --- |
| `pet_id` | INT UNSIGNED | FK → pets.id, **ON DELETE CASCADE** | 宠物删了，相关申请无意义 |
| `applicant_id` | INT UNSIGNED | FK → users.id, **ON DELETE SET NULL** | 用户删了，申请记录仍要留存审计 |
| `reason` | VARCHAR(500) | NOT NULL | 领养理由 |
| `contact_phone` / `address` | VARCHAR | NOT NULL | 联系方式 |
| `status` | ENUM('pending','approved','rejected','cancelled') | DEFAULT 'pending' | 申请状态机 |
| `review_remark` | VARCHAR(255) | | 审核意见 |
| `reviewed_by` | INT UNSIGNED | FK → users.id, ON DELETE SET NULL | 审核人 |
| `reviewed_at` | DATETIME | | |

### 3.2 为什么外键用两种删除策略

这不是随手写的：

- `pet_id` 用 `CASCADE` —— 申请依附于宠物，宠物不存在了申请就是脏数据，留着只会让列表里的 JOIN 变成 LEFT JOIN 再处处判空。
- `applicant_id` / `reviewed_by` 用 `SET NULL` —— 申请记录本身是**业务凭证**，用户注销不应该让历史申请消失。字段可空（`NULL`）表达"申请人已注销"，比丢记录正确。

### 3.3 索引

除主键与唯一索引外，为高频查询条件建索引：`pets(status)`、`pets(category)`、`adoptions(status)`、`adoptions(pet_id, applicant_id)`（重复申请检查走这个组合索引）。

---

## 四、核心业务设计

### 4.1 宠物状态机

```
available ──提交申请──> pending ──审核通过──> adopted
    ↑                      │
    └── 无待审申请时回退 ────┘（申请被拒 / 被撤销）

available ←──下架/上架──> offline
```

### 4.2 申请状态机

```
pending ──> approved   （管理员通过）
pending ──> rejected   （管理员拒绝）
pending ──> cancelled  （申请人撤销）
```

`approved` / `rejected` / `cancelled` 都是终态，不可再迁移。

### 4.3 三个并发问题与解法

**问题一：同一用户对同一宠物重复申请**

朴素写法是「先查有没有，再插入」，两个请求同时到达时都会查到「没有」，于是插入两条。解法是在事务内用行锁串行化：

```sql
SELECT ... FROM pets WHERE id = ? FOR UPDATE;      -- 锁住宠物行
SELECT id FROM adoptions
  WHERE pet_id = ? AND applicant_id = ? AND status IN ('pending','approved');
-- 有结果 → 抛 409
```

`FOR UPDATE` 让并发请求排队，后到的那个会看到前一个已提交的数据。

**问题二：审核通过时两张表要同时改**

通过一次审核要写三处：

1. 本条申请 → `approved`
2. 同一宠物的**其它待审申请** → `rejected`（附言"该宠物已被他人领养"）
3. 宠物 → `adopted`

如果分三次独立执行，中间任一步失败就会留下「申请已通过但宠物还显示待领养」这类需要人工修的脏数据。因此全部包在一个 `transaction` 里，`db.transaction(handler)` 负责 `BEGIN / COMMIT / ROLLBACK` 与连接释放。

第 2 步是容易漏的业务细节：一只宠物可能有多人同时申请，审核通过时若不清理，其它申请会永远悬在「待审核」，申请人在「我的申请」里看到的是一个永远不会变的状态。

**问题三：拒绝或撤销后宠物的状态**

不能直接把宠物改回 `available` —— 如果还有别的待审申请，改回去会让这只宠物重新出现在待领养列表里，等于**别人正在排队的申请被无视了**。

所以恢复条件是「该宠物已无任何 `pending` 申请」：

```sql
SELECT COUNT(*) FROM adoptions WHERE pet_id = ? AND status = 'pending';
-- 为 0 时，且宠物当前是 pending，才恢复为 available
```

注意更新语句里带上 `AND status = ?` 作为前置条件，避免把已经 `adopted` 的宠物误改。

### 4.4 为什么用 `SELECT ... FOR UPDATE` 而不是乐观锁

乐观锁（版本号 + `WHERE version = ?`）在冲突时需要应用层重试，逻辑更绕；这里的冲突概率低、事务体量小（毫秒级），悲观锁实现简单且行为可预测。**选简单的那个** —— 如果未来宠物表出现高频写入，再换成乐观锁也不迟。

---

## 五、接口与错误处理约定

### 5.1 统一响应

```json
{ "code": 200, "message": "操作成功", "data": {} }
```

HTTP 状态码与 `code` 保持一致，前端与网关都能按标准语义处理。分页统一为 `{ list, total, page, size, pages }`——`pages` 由后端算好，避免每个页面各写一遍 `Math.ceil`。

### 5.2 错误处理

业务代码只做一件事：`throw new AppError('该宠物已被领养，无法申请', 400)`。剩下的交给 `middleware/errorHandler.js`：

| 情况 | 处理 |
| --- | --- |
| `AppError` | 用自带的 `statusCode` 与 `message` 返回 |
| 校验失败 | 由 `validate` 中间件汇总成一条 400，多条错误用「；」连接 |
| JSON 解析失败（`entity.parse.failed`） | 400「请求体不是合法的 JSON」 |
| `ER_DUP_ENTRY` | 409「数据已存在」 |
| `ER_NO_REFERENCED_ROW_2` | 400「关联的数据不存在」 |
| `ER_ROW_IS_REFERENCED_2` | 409「该数据被其它记录引用，无法删除」 |
| `ECONNREFUSED` | 503「数据库连接失败」 |
| 其它 | 500，且**生产环境隐藏原始 message 与堆栈** |

把 MySQL 错误码映射成中文提示，是为了让前端不必解析数据库错误。

### 5.3 `asyncHandler` 的必要性

Express 4 不会捕获 async 函数里的 reject —— 不包一层，`async` 路由抛错会变成「请求挂起 + 进程 unhandledRejection」。`asyncHandler` 把 Promise 的 reject 转交给 `next(err)`，这是 Express 4 项目里最常见的隐性 bug 来源。

### 5.4 分页限幅

`normalizePagination` 统一处理：`page` 最小 1，`size` 夹在 `1..PAGE_SIZE_MAX(100)`。

同时有个易错点：路由**不应该**用 `req.query.size` 去算分页元信息，而要用模型归一化后返回的 `size`。否则前端传 `size=99999` 时，实际只返回 100 条，但 `pages` 却按 99999 算——前端翻页逻辑直接错乱。所以 `models/*.list()` 统一返回 `{ list, total, page, size }`（已归一化），路由只做转发。

### 5.5 参数校验：一个踩过的坑

`express-validator` 的链式调用是**就地修改**的。最初把一条校验链抽成常量复用：

```js
// 错误写法：同一条链被两个路由共用
const updateValidators = [...];
router.post('/pets', petValidators(), ...);      // 新增：字段必填
router.put('/pets/:id', petValidators(), ...);   // 更新：字段可选
```

只要更新路由先被加载并调用了 `.optional()`，这条链就会永久变成可选，**新增接口的必填校验静默失效**。修正为工厂函数，每次调用都重新构建：

```js
function petValidators({ allOptional = false } = {}) {
  const must = (chain) => (allOptional ? chain.optional({ values: 'falsy' }) : chain);
  ...
}
```

顺带约定：**空字符串一律视为「未提供」**。前端表单里选填项没填就是 `''`，直接入库会覆盖列默认值（`''` 通过了 `NOT NULL`，但语义上它是空的）。所以路由统一过一层 `normalizeBody()` 把 `''` 转成 `undefined`，模型再"只写入显式提供的字段"。

这个约定修掉了一个真实 bug：`pets.status` 有 `NOT NULL DEFAULT 'available'`，但创建时把未提供的 `status` 写成 `NULL`，直接触发 `Column 'status' cannot be null`。

---

## 六、安全设计

| 风险 | 措施 |
| --- | --- |
| 密码泄露 | bcrypt 加盐哈希（`BCRYPT_ROUNDS` 可配）；`mapUser` 出口不含 `password_hash`，`toPublic` 再收敛一次字段 |
| SQL 注入 | 全部查询走 `?` 占位符；`ORDER BY` / `LIMIT` 的数值部分由 `normalizePagination` 转成整数后拼接 |
| LIKE 通配符攻击 | `utils/sql.js` 的 `like()` 转义 `%` `_` `\`，否则用户搜 `%` 会全表扫描 |
| 账号枚举 | 登录时「用户不存在」与「密码错误」返回同一提示，不让攻击者探测有效用户名 |
| 越权 | `auth` 校验 JWT，`requireAdmin` 校验角色；「只能撤销自己的申请」在模型层比对 `applicant_id` |
| 暴力破解 | JWT 带 `exp`；账号可被管理员禁用（`status = 0` 时拒绝登录） |
| 信息泄露 | `app.disable('x-powered-by')`；生产环境隐藏错误堆栈 |
| 响应头攻击 | `helmet`（为兼容 Swagger UI 的内联脚本，仅关闭 CSP） |
| 弱密钥 | 生产环境启动时校验 `JWT_SECRET` 是否设置，缺失直接退出——**让配置错误在启动期暴露，而不是运行期** |

---

## 七、测试设计

`jest --runInBand`（顺序执行，避免多个 worker 争抢同一个测试库）。

**隔离**：测试库固定为 `pet_adoption_test`，`globalSetup` 执行 `DROP DATABASE + CREATE + init.sql`，`globalTeardown` 清理连接。开发库 `pet_adoption` 不受影响。

**不监听端口**：`app.js` 导出 `{ app, bootstrap }`，测试把 `app` 直接交给 Supertest。好处是测试不需要挑端口、不需要等待启动、也不会有端口残留。

**三个套件的分工**：

| 套件 | 关注 |
| --- | --- |
| `auth.test.js` | 注册校验、重复用户名、登录成败、禁用账号、Token 缺失/伪造、改资料改密码 |
| `pet.test.js` | 分页与限幅、各筛选条件、浏览量自增、增删改权限、字段类型校验 |
| `adoption.test.js` | **完整状态机**：提交→通过/拒绝、重复申请 409、撤销、多人竞申、权限边界、统计口径 |

覆盖面刻意偏重 `adoption` —— 它是业务核心也是并发风险集中点。

**结果**：3 套件 / 60 用例全部通过。

重构过程中，测试直接暴露了两个真 bug（`status` 被写成 NULL、`pages` 用了未归一化的 `size`），以及一处测试自身的错误假设。这正是不写测试时最难发现的那类问题。

---

## 八、v1.0 → v2.0 重构记录

| 维度 | v1.0 | v2.0 |
| --- | --- | --- |
| 业务 | 宠物增删查；用户注册登录 | 新增 `adoptions` 表，完整领养状态机（申请 / 审核 / 撤销 / 竞申） |
| 表数量 | 2 | 3 |
| 分层 | 路由里直接写 SQL，模型层只是薄封装 | 路由 / 校验 / 模型 / 工具 / 配置 / 中间件 各司其职，路由内无 SQL |
| 事务 | 无 | `db.transaction()` 封装 BEGIN/COMMIT/ROLLBACK，审核流程用 `FOR UPDATE` 行锁 |
| 密码 | 明文 | bcrypt 加盐哈希 |
| 认证 | 各处自行解析 token | `auth` / `requireAdmin` 中间件统一处理 |
| 错误处理 | 每个接口自己 `res.json` | `AppError` + 统一 `errorHandler`，含 MySQL 错误码映射 |
| 参数校验 | 无 | `express-validator` 全字段校验 + 统一失败出口 |
| 配置 | 硬编码 | `config/` 集中读取，`.env.example` 模板，生产环境强校验 |
| 分页 | 无 | 统一分页 + 限幅 + 归一化元信息 |
| 接口文档 | 手写 Markdown 且已过期 | JSDoc 生成 OpenAPI 3，`/api-docs` 在线调试 |
| 测试 | 无 | Jest + Supertest，3 套件 60 用例 |
| 部署 | 无 | Dockerfile 三阶段构建 + docker-compose + 健康检查 |
| 前端 | 单文件 `public/index.html`（31KB，与后端强耦合） | Vue3 + Element Plus + ECharts，7 个页面，前后端分离 |

**保留的东西**：`init.sql` 的建表思路、`db/db.js` 的连接池配置、路由的 URL 风格。重构不是重写，能复用的就复用。

---

## 九、已知限制与后续方向

诚实地列出来，这些是下一步而不是"已完成"：

1. **没有文件上传** —— `pets.image_url` 目前只能填外链。应加 `multer` + 本地/对象存储，并做类型与大小校验。
2. **看板统计实时查库** —— 数据量大时应改为按天预聚合的统计表或走缓存，目前每次刷新都是全表 `COUNT`。
3. **Token 无法主动失效** —— JWT 是无状态的，改密码后旧 token 在过期前仍有效。可引入 `token_version` 字段或 Redis 黑名单。
4. **没有限流** —— 登录接口应加 `express-rate-limit`，防暴力破解。
5. **前端未做单元测试** —— 目前依赖后端测试 + 手工冒烟。可补 Vitest + Vue Test Utils。
6. **`stats` 系列接口未分页保护** —— 目前是全表聚合，属管理员低频调用，暂可接受。
