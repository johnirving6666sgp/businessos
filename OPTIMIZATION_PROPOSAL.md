# BusinessOS 优化方案（v2 已落地后的再优化）

> 状态：**方案稿，未改动任何代码**。
> 基线：当前 `main`（commit `cd3b903`）。v2 重构方案（`REDESIGN_PROPOSAL.md`）已基本落地，本文档针对**已实现的代码**做增量优化，不推翻架构。
> 排序原则：收益 ÷ 改动量，从高到低。

---

## 总览

| # | 优化项 | 收益 | 改动量 | 风险 | 文件 |
|---|--------|------|--------|------|------|
| 1 | Prompt Caching | 🔴 输入成本 ↓~80%、TTFB ↓ | 小 | 低 | `worker/lib/llm.mjs`、`agent.mjs` |
| 2 | 修流式数据丢失 bug | 🔴 消息不再丢 | 极小 | 低 | `worker/routes/conversations.mjs` |
| 3 | 上下文查询并行化 | 🟠 TTFB ↓ | 中 | 低 | `worker/lib/agent.mjs` |
| 4 | token 用量可观测 | 🟠 成本可见 | 中 | 低 | `llm.mjs`、`conversations.mjs` |
| 5 | token 存储改纯 cookie | 🟠 关 XSS 窃取面 | 小 | 中 | `src/api/client.js`、`auth.mjs` |
| 6 | 登录限速 | 🟠 防爆破 | 小 | 低 | `worker/routes/auth.mjs` |
| 7 | 常量时间比对密码 | 🟡 防时序 | 极小 | 低 | `worker/lib/auth.mjs` |
| 8 | URL 路由 | 🟡 可深链/刷新 | 中 | 低 | `src/App.jsx` |
| 9 | 代码分割 | 🟡 首屏 ↓ | 小 | 低 | `src/App.jsx` |
| 10 | 修 lint + 补单测 | 🟡 质量基线 | 中 | 低 | `package.json`、新增 `test/` |
| 11 | schema 与 seed 分离 | 🟡 防演示数据进生产 | 中 | 中 | `migrations/`、`package.json` |

---

## 🔴 P0 — AI 对话链路

### 1. 引入 Prompt Caching（最高收益）

**问题**：[`agent.mjs:175-206`](worker/lib/agent.mjs) 的【公司背景 / 核心竞争优势 / 客户群体 / 竞争对手 / 回答原则】是一段约 1000+ token 的**静态前缀**，每条消息都原样重发；[`llm.mjs:49`](worker/lib/llm.mjs) 的请求体没有任何 `cache_control`。按 token 计费下，这是纯浪费。

**方案**：把 system prompt 拆成**静态段（可缓存）** + **动态段（每次变）**，对静态段打缓存标记。

- `buildSystemPrompt` 改为返回结构化 system 块数组，而非单个字符串：
  ```js
  // agent.mjs —— 返回 [{type:'text', text, cache_control?}]
  return [
    { type: 'text', text: STATIC_COMPANY_PROFILE + roleStyle, cache_control: { type: 'ephemeral' } },
    { type: 'text', text: dynamicLines.join('\n') }, // 任务/客户/实体等
  ]
  ```
- `streamAnthropic` 的 `system` 字段直接接受数组（Anthropic API 原生支持 system blocks + cache_control）。
- 静态段内容要真正"稳定"：把 `ROLE_PROFILES[user.id].style` 也放进静态段（每个用户固定），动态数据（待办、客户列表、实体详情）放第二块。

**注意**：缓存最小 token 阈值（约 1024，Haiku 略高）。当前静态段够长，达标。缓存 TTL 5 分钟，连续对话能命中。

**验收**：对同一会话连发两条消息，第二条响应的 usage 里 `cache_read_input_tokens` > 0。

---

### 2. 修复 CF 流式下的消息丢失 bug

**问题**：[`conversations.mjs:196`](worker/routes/conversations.mjs) 先 `processStream()`（不 await）再 `return new Response(readable)`。模式本身对，但**没有 `c.executionCtx.waitUntil(...)`**。在 Cloudflare 上，Response 返回后 Worker 实例可能被立即回收——若客户端在流结束前断开，[`conversations.mjs:171`](worker/routes/conversations.mjs) 把 AI 回复 `INSERT` 进 `messages` 的那步可能**根本没跑完**，回复丢失。本地 Node（`server.mjs`）不会复现，**线上才偶发**。

**方案**：
```js
const streamPromise = processStream()
c.executionCtx?.waitUntil(streamPromise)   // 保证后台写库完成
return new Response(readable, { headers: {...} })
```
（`server.mjs` 的 Node 适配里 `executionCtx` 可能为空，故用可选链；Node 进程不回收，无影响。）

**验收**：流式过程中刷新/关闭前端页面，回到会话仍能看到完整 AI 回复。

---

### 3. 上下文构建查询并行化 + 实体识别走索引

**问题**：Level 2/3 时 [`agent.mjs`](worker/lib/agent.mjs) 顺序 await：`autoResolveEntity`（[L114](worker/lib/agent.mjs)、[L129](worker/lib/agent.mjs) 两次查询，扫最多 50 行后在 JS 里做 `fuzzySubstrMatch` 子串匹配）→ 客户详情 → 交互记录 → 关联任务 → 热门商机 → 知识库。全串行，全部加在 LLM 调用前，直接拖慢首字时间。

**方案**：
- 互不依赖的查询用 `Promise.all` 合并（如客户详情 / 交互 / 关联任务一组；热门商机 / 知识库一组）。
- `autoResolveEntity` 的 JS 全表模糊匹配改为 DB 侧 `LIKE` / FTS：
  - 短期：给 `customers(name)`、`opportunities(org_name)` 加索引，用 `WHERE name LIKE ?` 做前缀匹配。
  - 中期：若要中文子串匹配，考虑 D1 的 FTS5 虚拟表。
- `D1.batch()` 可把多条只读 prepare 合并为一次往返。

**验收**：Level 3 会话的服务端"开始流式前"耗时下降（可加一条 `console.time` 对比）。

---

### 4. token 用量可观测（字段已存在，从未写入）

**问题**：schema 早就建了 [`messages.tokens_used`、`messages.context_snapshot`](migrations/0001_init.sql)，代码从没写过。Anthropic 流尾 `message_delta.usage`（含 `input_tokens`/`output_tokens`/`cache_read_input_tokens`）被 [`llm.mjs:99`](worker/lib/llm.mjs) 附近直接丢弃。一个按量计费产品却没有用量数据。

**方案**：
- `streamAnthropic` 解析 `message_start` / `message_delta` 的 `usage`，作为一个 `{type:'usage', ...}` SSE 事件透传。
- [`conversations.mjs`](worker/routes/conversations.mjs) 的 `processStream` 收到 usage 后，写入 `messages.tokens_used`，并把 `{contextLevel, entity, model}` 摘要写进 `context_snapshot`。
- 顺带：用量按 `user_id / 日` 聚合，未来能在 admin 面板出成本看板。

**验收**：发一条消息后查 `messages` 表，`tokens_used` 非空。

---

## 🟠 P1 — 安全

### 5. token 存储改为纯 HttpOnly cookie

**问题**：[`client.js:9`](src/api/client.js) 从 `localStorage` 读 token 发 `Authorization: Bearer`，同时 [`auth.mjs:104`](worker/lib/auth.mjs) 又下发 HttpOnly cookie。HttpOnly 的意义是 JS 读不到 token 以防 XSS 窃取——但 token 同时进了 localStorage，**防护被自己抵消**。

**方案**：前端不再存/发 token，全靠 `credentials:'include'` 带 cookie；`requireAuth` 保留 Bearer 仅供爬虫/脚本用机器密钥时使用。需确认跨域场景下 `SameSite` 是否够用（同域部署则无忧）。

**风险**：纯 cookie 跨站调用受限——确认前后端同域部署（CF Assets + Worker 同 origin，满足）。

---

### 6. 登录限速

**问题**：[`auth.mjs`](worker/routes/auth.mjs) 登录无任何限速，可暴力破解（PBKDF2 100k 只是减慢单次，挡不住量）。

**方案**：按 `username + IP` 在 D1 或 CF KV 里做滑动窗口计数（如 5 次/分钟失败即锁 15 分钟）。轻量可先用一张 `login_attempts` 表。

---

### 7. 常量时间比对密码哈希

**问题**：[`auth.mjs:39`](worker/lib/auth.mjs) `computed === hashHex` 非常量时间。对哈希值实际风险很低，但顺手可改。

**方案**：逐字节 XOR 累加比较，或比较两段 `ArrayBuffer` 的等长常量时间实现。

---

## 🟡 P2 — 前端 & 工程化

### 8. URL 路由

**问题**：[`App.jsx:38`](src/App.jsx) 用 `useState('dashboard')` 切页——无 URL、刷新丢失当前页、不能深链、浏览器后退失效。

**方案**：引入轻量 hash 路由（`window.location.hash` + `hashchange`，或 `wouter` ~1KB）。`PAGES` 映射保留，只把 `currentPage` 与 URL 双向同步。深链需求（如直接打开某客户）也靠这个。

### 9. 按页代码分割

**问题**：构建产物 263KB 单包（gzip 78KB），`Proposals`(455 行)、`Customers`(398 行)、`Knowledge`(360 行) 等首屏全量加载。

**方案**：`const Proposals = React.lazy(() => import('./pages/Proposals.jsx'))` + `<Suspense>`。登录页/Dashboard 首屏，其余懒加载。

### 10. 修 lint + 补 Agent 单测

**问题**：`npm run lint` 报 `eslint: command not found`（脚本引用了未装的 eslint）；全项目零测试。

**方案**：
- `npm i -D eslint` + 一份 flat config（React + hooks 规则），或删掉失效脚本。
- 先给纯函数补单测：`detectContextLevel`、`detectIntentSignals`、`autoResolveEntity`、`extractActions`、`auth` 的 `hashPassword/verifyPassword` 往返。用 `node --test`（零依赖）即可。

### 11. schema 与 seed 分离

**问题**：`migrations/` 里混了 `0003_demo_data.sql`、`0004_fix_data.sql`。`npm run db:migrate:remote` 只跑 `0001_init.sql`（见 [`package.json`](package.json)），但目录结构容易误导，且演示数据有进生产之虞。

**方案**：`migrations/` 只放结构 DDL；演示/种子数据移到 `seeds/`，由 `db:seed:*` 脚本单独执行。生产部署文档明确"只跑 migrations，不跑 seeds"。

---

## 建议执行顺序

1. **P0 第 2 项**（流式 bug）——一行级改动，先止血。
2. **P0 第 1 项**（Prompt Caching）——最大成本/延迟收益。
3. **P0 第 4 项**（用量记录）——让前两项的收益可被度量。
4. **P0 第 3 项**（并行化）。
5. P1 安全三项打包做。
6. P2 按需。

> 每项都可独立成一个 commit，互不阻塞。需要我把其中任意一项落实为代码时再说。
