# BusinessOS 重构方案

> 基于对 PROJECT_DOCUMENTATION.md 的深度分析，完全重新设计。
> 目标：让系统真正好用，而不只是功能完整。

---

## 一、现有方案的根本问题

Codex 做的版本功能点都有，但有四个结构性错误：

### 1. 前端是一个无法维护的巨石

`src/main.jsx` 装了所有页面、所有状态、所有逻辑。这不是"单页应用"，这是"单文件应用"。随便加一个功能就要在 10000 行里找位置，改一处容易破坏另一处。

### 2. D1 存整包 JSON 是伪数据库

把所有数据打包成一个 JSON 存进 D1，查询时取出整包、修改、写回。这意味着：
- 无法按字段查询
- 无法排序、分页、聚合
- 并发写入会覆盖数据
- 随着数据增长，单次读写成本线性上升

### 3. Agent 上下文污染导致回答质量下降

每次对话开始，系统把所有用户资料 + 所有客户 + 所有任务 + 历史对话全部塞进 prompt。结果：
- 模型注意力分散在大量无关信息上
- 回答质量不如直接用 Claude.ai
- Token 成本高，速度慢

这是文档第 16.2 节自己指出的问题，但没有从架构层面解决。

### 4. Cloudflare Worker 承担了它做不好的工作

CF Worker 有 CPU 时间限制，边缘节点 IP 被国内招标网站封锁，不适合做爬虫主力。定时任务靠 Worker Cron 触发，一旦被封就沉默失败，没有告警。

---

## 二、新方案的核心原则

### 原则一：对话质量第一

个人助理的价值在于回答质量。新对话必须像直接用 Claude 一样好，甚至更好（因为 AI 知道你是谁）。上下文注入要克制、精准、按需。

### 原则二：数据模型先行

所有功能都建立在正确的数据库表结构上。先把表设计好，再写功能。不为了快速起步牺牲数据结构。

### 原则三：前端组件化

每个功能模块是独立组件。改客户看板不会影响对话界面。加新功能不需要在整个文件里找位置。

### 原则四：爬虫独立于主系统

招标抓取是独立的 Node.js 服务，通过 API 写入系统。主系统不依赖爬虫能否运行，爬虫失败有明确告警，不是沉默失败。

---

## 三、数据库设计（D1 正式表结构）

```sql
-- 用户与权限
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  display_name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT DEFAULT 'member',         -- super_admin | admin | member
  model_tier TEXT DEFAULT 'haiku',    -- opus | sonnet | haiku
  permissions TEXT DEFAULT '{}',      -- JSON: {agents, customers, tasks, quote, quoteTraining, insight}
  is_active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  expires_at TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);

-- 对话与消息
CREATE TABLE conversations (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  agent_type TEXT NOT NULL,           -- personal | opportunity | customer | task | proposal | knowledge
  title TEXT,
  context_level INTEGER DEFAULT 0,    -- 0=纯净 1=轻量 2=精准 3=完整
  is_archived INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE messages (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL REFERENCES conversations(id),
  role TEXT NOT NULL,                 -- user | assistant | system
  content TEXT NOT NULL,
  context_snapshot TEXT,              -- 注入时的上下文摘要（调试用）
  tokens_used INTEGER,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE message_feedback (
  id TEXT PRIMARY KEY,
  message_id TEXT NOT NULL REFERENCES messages(id),
  user_id TEXT NOT NULL REFERENCES users(id),
  type TEXT NOT NULL,                 -- useful | inaccurate | need_detail
  note TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

-- 商机线索
CREATE TABLE opportunities (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  source_platform TEXT,               -- ctbpsp | qianlima | manual
  source_url TEXT,
  raw_content TEXT,
  org_name TEXT,                      -- 招标单位
  budget TEXT,
  deadline TEXT,
  contact_info TEXT,
  keywords TEXT,                      -- JSON array
  status TEXT DEFAULT 'pending',      -- pending | verified | merged | dismissed
  merged_into TEXT REFERENCES opportunities(id),
  fetch_quality TEXT DEFAULT 'partial', -- partial | full
  crawled_at TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE opportunity_ratings (
  id TEXT PRIMARY KEY,
  opportunity_id TEXT NOT NULL REFERENCES opportunities(id),
  user_id TEXT NOT NULL REFERENCES users(id),
  score INTEGER NOT NULL,             -- 0 | 30 | 60 | 80 | 100
  note TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  UNIQUE(opportunity_id, user_id)
);

CREATE TABLE opportunity_saves (
  id TEXT PRIMARY KEY,
  opportunity_id TEXT NOT NULL REFERENCES opportunities(id),
  user_id TEXT NOT NULL REFERENCES users(id),
  created_at TEXT DEFAULT (datetime('now')),
  UNIQUE(opportunity_id, user_id)
);

-- 客户管理
CREATE TABLE customers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  stage TEXT DEFAULT 'untouched',     -- untouched | contacted | interested | quoting | closing | won | lost
  owner_id TEXT REFERENCES users(id),
  industry TEXT,
  contact_name TEXT,
  contact_phone TEXT,
  contact_email TEXT,
  website TEXT,
  notes TEXT,
  source_opportunity_id TEXT REFERENCES opportunities(id),
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE customer_interactions (
  id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL REFERENCES customers(id),
  user_id TEXT NOT NULL REFERENCES users(id),
  type TEXT,                          -- call | meeting | email | note | stage_change
  summary TEXT,
  next_action TEXT,
  next_action_due TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

-- 任务
CREATE TABLE tasks (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  assignee_id TEXT REFERENCES users(id),
  creator_id TEXT REFERENCES users(id),
  status TEXT DEFAULT 'todo',         -- todo | in_progress | waiting | done | closed
  priority TEXT DEFAULT 'normal',     -- high | normal | low
  due_date TEXT,
  source_type TEXT,                   -- conversation | meeting | opportunity | broadcast | proposal
  source_id TEXT,
  customer_id TEXT REFERENCES customers(id),
  opportunity_id TEXT REFERENCES opportunities(id),
  proposal_id TEXT,
  result_summary TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- 方案与报价
CREATE TABLE proposals (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  customer_id TEXT REFERENCES customers(id),
  creator_id TEXT REFERENCES users(id),
  status TEXT DEFAULT 'draft',        -- draft | review | sent | won | lost
  scope TEXT,                         -- 设备/服务范围
  tech_params TEXT,                   -- JSON: 技术参数
  cost_breakdown TEXT,                -- JSON: 成本构成
  risk_points TEXT,
  price_range_min REAL,
  price_range_max REAL,
  negotiation_space TEXT,
  open_questions TEXT,                -- 需要人工确认的问题
  reference_cases TEXT,               -- JSON: 历史参考
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- 知识库
CREATE TABLE knowledge_items (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  tags TEXT,                          -- JSON array
  author_id TEXT REFERENCES users(id),
  visibility TEXT DEFAULT 'team',     -- private | team | public
  source_type TEXT,                   -- conversation | task | proposal | manual
  source_id TEXT,
  is_published INTEGER DEFAULT 0,     -- Jamie 审核后发布
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- 广播
CREATE TABLE broadcasts (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  creator_id TEXT NOT NULL REFERENCES users(id),
  target_user_ids TEXT NOT NULL,      -- JSON array
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE broadcast_responses (
  id TEXT PRIMARY KEY,
  broadcast_id TEXT NOT NULL REFERENCES broadcasts(id),
  user_id TEXT NOT NULL REFERENCES users(id),
  status TEXT NOT NULL,               -- received | following_up | need_discussion
  note TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  UNIQUE(broadcast_id, user_id)
);

-- Agent 配置与成长
CREATE TABLE agent_configs (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  agent_type TEXT NOT NULL,
  system_prompt_override TEXT,
  growth_level INTEGER DEFAULT 0,     -- 0~9 对应初级~五星
  growth_points INTEGER DEFAULT 0,
  updated_at TEXT DEFAULT (datetime('now')),
  UNIQUE(user_id, agent_type)
);
```

---

## 四、Agent 上下文协议（核心创新）

### 四级上下文模型

```
Level 0 — 纯净模式（新对话默认）
  注入内容：仅用户姓名 + 角色
  适用：通用问题、头脑风暴、文件分析
  质量：等同于直接用 Claude

Level 1 — 轻量模式（2+ 轮后自动）
  注入内容：用户最近 3 条任务 + 2 个跟进中客户
  适用：日常工作讨论，有隐含业务背景

Level 2 — 精准模式（意图检测触发）
  注入内容：单个客户完整资料 OR 单个商机详情 OR 相关任务列表
  触发信号：用户提到具体客户名、商机编号、任务关键词

Level 3 — 完整模式（用户明确请求）
  注入内容：客户 + 任务 + 相关方案 + 相关商机 + 知识库摘要
  适用：生成方案、复杂决策、全面复盘
```

### 意图信号检测（前端 + 后端双层）

```javascript
// 前端实时检测，决定是否预加载上下文
const INTENT_SIGNALS = {
  customer: /客户|合同|报价|拜访|跟进|联系|谈判/,
  task: /任务|截止|完成|负责|分配|进度/,
  opportunity: /招标|商机|线索|投标|项目/,
  proposal: /方案|报价|设备|参数|成本|风险/,
  knowledge: /经验|复盘|上次|之前|历史/,
}

function detectContextLevel(messages) {
  if (messages.length < 2) return 0
  const recentText = messages.slice(-3).map(m => m.content).join(' ')
  const hits = Object.values(INTENT_SIGNALS).filter(r => r.test(recentText))
  if (hits.length === 0) return 1
  if (hits.length >= 2) return 3
  return 2
}
```

### System Prompt 结构

```
[基础层 - 始终存在]
你是 {user.display_name} 的工作助理，在一家专注于真空熔炼设备的公司工作。
直接回答问题，先解决问题，再提供可选的下一步动作。
不要在每条回复中强制引入业务流程。

[上下文层 - 按需注入]
（Level 1）当前跟进中的客户：...
（Level 2）关于 {entity_name} 的详细信息：...
（Level 3）完整业务上下文：...

[能力层 - 始终存在]
当你判断用户需要时，你可以：
- 建议创建任务（用户确认后生成）
- 建议更新客户阶段
- 调用方案工程师（需用户触发）
不要主动打断对话去调用这些能力，除非用户明确需要。
```

---

## 五、前端架构

### 目录结构

```
src/
├── main.jsx                  # 入口，路由注册
├── App.jsx                   # 根组件，Auth Guard
│
├── pages/                    # 页面级组件（路由直接对应）
│   ├── Dashboard.jsx         # 工作台（"今天先做什么"）
│   ├── Chat.jsx              # 个人 Agent 对话
│   ├── Opportunities.jsx     # 线索池
│   ├── Customers.jsx         # 客户管理
│   ├── Tasks.jsx             # 任务看板
│   ├── Proposals.jsx         # 方案工程师
│   ├── Knowledge.jsx         # 内部信息仓
│   └── Admin.jsx             # Jamie Central（仅 super_admin）
│
├── components/
│   ├── layout/
│   │   ├── AppShell.jsx      # 整体布局（侧边栏 + 主内容）
│   │   ├── Sidebar.jsx       # 桌面侧边栏
│   │   ├── BottomNav.jsx     # 移动端底部导航
│   │   └── TopBar.jsx        # 顶部栏（用户头像、通知）
│   │
│   ├── chat/
│   │   ├── MessageList.jsx   # 消息列表（虚拟滚动）
│   │   ├── MessageBubble.jsx # 单条消息气泡
│   │   ├── MessageInput.jsx  # 输入框（文字+语音+文件）
│   │   ├── ContextBadge.jsx  # 显示当前上下文级别
│   │   └── FeedbackBar.jsx   # 有用/不准/需更具体
│   │
│   ├── opportunities/
│   │   ├── OpportunityList.jsx
│   │   ├── OpportunityCard.jsx  # 收起/展开
│   │   ├── RatingButtons.jsx    # 0/30/60/80/100
│   │   └── OpportunityFilter.jsx
│   │
│   ├── customers/
│   │   ├── CustomerKanban.jsx   # 阶段看板
│   │   ├── CustomerCard.jsx
│   │   ├── CustomerDetail.jsx
│   │   └── InteractionLog.jsx
│   │
│   ├── tasks/
│   │   ├── TaskBoard.jsx        # 状态列看板
│   │   ├── TaskCard.jsx
│   │   └── TaskForm.jsx
│   │
│   └── ui/                   # 基础 UI 组件
│       ├── Button.jsx
│       ├── Card.jsx
│       ├── Badge.jsx
│       ├── Modal.jsx
│       ├── Toast.jsx
│       └── Spinner.jsx
│
├── store/                    # Zustand 状态管理（按域分离）
│   ├── auth.js               # 登录态、用户信息、权限
│   ├── conversations.js      # 对话列表、消息
│   ├── opportunities.js      # 线索池
│   ├── customers.js          # 客户
│   ├── tasks.js              # 任务
│   └── ui.js                 # 通知、模态、toast
│
└── api/                      # API 客户端（按域分离）
    ├── client.js             # fetch 封装，统一错误处理
    ├── auth.js
    ├── conversations.js
    ├── opportunities.js
    ├── customers.js
    ├── tasks.js
    └── proposals.js
```

### 状态管理原则

- 每个业务域有自己的 Zustand store，不共享一个大 store
- UI 状态（modal open、toast）单独在 `ui.js`
- 异步操作（API 调用）在 store 的 action 里，不在组件里
- 组件只 `useStore(selector)` 取它需要的最小数据

---

## 六、Dashboard 重新设计

### 设计目标

不是"模块入口列表"，而是"优先级排序的今日工作清单"。

### 优先级算法

```javascript
function buildDashboardItems(user, data) {
  const items = []
  
  // P0: 80+ 分商机（任何同事评分）
  data.opportunities
    .filter(o => o.maxRating >= 80 && !o.savedByUser)
    .slice(0, 3)
    .forEach(o => items.push({ type: 'hot_opportunity', data: o, priority: 10 }))
  
  // P0: 我负责、今天或明天截止的任务
  data.tasks
    .filter(t => t.assigneeId === user.id && isDueSoon(t.dueDate, 2))
    .forEach(t => items.push({ type: 'urgent_task', data: t, priority: 9 }))
  
  // P1: 我的客户，7天无互动
  data.customers
    .filter(c => c.ownerId === user.id && daysSince(c.lastInteraction) > 7)
    .slice(0, 3)
    .forEach(c => items.push({ type: 'stale_customer', data: c, priority: 7 }))
  
  // P1: 待我回复的广播
  data.broadcasts
    .filter(b => b.targetUserIds.includes(user.id) && !b.myResponse)
    .forEach(b => items.push({ type: 'pending_broadcast', data: b, priority: 6 }))
  
  // P2: 我创建但未被认领的任务
  data.tasks
    .filter(t => t.creatorId === user.id && t.status === 'todo' && !t.assigneeId)
    .slice(0, 2)
    .forEach(t => items.push({ type: 'unassigned_task', data: t, priority: 4 }))
  
  return items.sort((a, b) => b.priority - a.priority)
}
```

### Dashboard 布局

```
┌─────────────────────────────────────────┐
│  早上好，Larry。今天有 5 件事值得关注。    │
├─────────────────────────────────────────┤
│  🔥 热门商机                             │
│  ├ 某大学真空熔炼设备采购 [评分 80]        │
│  └ 某研究院靶材设备招标 [评分 100]         │
├─────────────────────────────────────────┤
│  ⏰ 今日截止任务                          │
│  └ 给王总发报价方案 · 截止今天 17:00      │
├─────────────────────────────────────────┤
│  💤 久未跟进的客户                        │
│  └ 科华半导体 · 已 12 天无互动            │
├─────────────────────────────────────────┤
│  📢 等你回复                              │
│  └ Jamie: 请确认下周客户拜访安排           │
├─────────────────────────────────────────┤
│  [与 Larry_AI 对话]  [查看所有线索]        │
└─────────────────────────────────────────┘
```

---

## 七、招标爬虫架构

### 独立服务，不依赖 CF Worker

```
crawler/
├── index.mjs             # 主入口，命令行调度
├── sources/
│   ├── ctbpsp.mjs        # 中国招标投标公共服务平台
│   └── qianlima.mjs      # 千里马平台
├── lib/
│   ├── fetch.mjs         # 带重试、限速、UA 轮换的 fetch
│   ├── dedup.mjs         # 去重逻辑
│   └── push.mjs          # 推送到系统 API
└── .github/workflows/
    └── crawl.yml         # GitHub Actions 定时触发
```

### GitHub Actions 定时配置

```yaml
# .github/workflows/crawl.yml
name: Crawl Tenders
on:
  schedule:
    - cron: '0 23 * * 0'   # 周一 07:00 HKT
    - cron: '0 23 * * 3'   # 周四 07:00 HKT
  workflow_dispatch:         # 支持手动触发
jobs:
  crawl:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - run: npm install
      - run: node crawler/index.mjs --push-to=${{ secrets.API_URL }}
        env:
          CRAWLER_API_KEY: ${{ secrets.CRAWLER_API_KEY }}
```

### 爬虫推送接口

```
POST /api/opportunities/import
Authorization: Bearer {CRAWLER_API_KEY}
Content-Type: application/json

{
  "source": "ctbpsp",
  "items": [
    {
      "title": "...",
      "source_url": "...",
      "org_name": "...",
      "budget": "...",
      "deadline": "...",
      "raw_content": "...",
      "keywords": ["熔炼", "真空"]
    }
  ]
}
```

系统收到后：
1. 按 `source_url` 去重
2. 关键词匹配打标签
3. 标记为 `fetch_quality: partial`（待人工补详情或详情爬虫补充）
4. 插入 `opportunities` 表

---

## 八、关键 API 设计

### 流式对话（SSE）

```
POST /api/conversations/:id/messages
→ Content-Type: text/event-stream

data: {"type":"token","content":"好的，"}
data: {"type":"token","content":"关于这个问题"}
data: {"type":"context_level","level":0}
data: {"type":"done","message_id":"msg_xxx","tokens":312}
```

前端用 `EventSource` 接收，实时渲染。

### 上下文注入接口

```
GET /api/context/load?level=2&entity_type=customer&entity_id=xxx
→ {
    "injected": "客户：科华半导体\n阶段：有意向\n负责人：Larry\n最近沟通：...",
    "tokens": 420
  }
```

后端按请求动态组装上下文，不在对话开始时一次性全注入。

---

## 九、开发计划

### Phase 1：核心骨架（优先）

- [ ] D1 建表，migration 脚本
- [ ] 登录/会话，权限加载
- [ ] 个人 Agent 对话（Level 0 上下文，流式输出）
- [ ] 基础 Dashboard（静态优先级列表）
- [ ] AppShell + BottomNav（移动端）+ Sidebar（桌面）

### Phase 2：商机系统

- [ ] 线索池页面（列表 + 展开卡片）
- [ ] 评分、收藏
- [ ] 爬虫独立服务 + GitHub Actions
- [ ] 商机导入 API
- [ ] 拉进对话（携带 Level 2 上下文）

### Phase 3：业务流闭环

- [ ] 客户看板（阶段拖拽）
- [ ] 任务板（来源追溯）
- [ ] 上下文 Level 1~3 实现
- [ ] 从对话一键生成任务

### Phase 4：高级功能

- [ ] 方案工程师 Agent + Skill 集成
- [ ] 知识库（Jamie 审核发布）
- [ ] 广播系统
- [ ] Agent 成长机制
- [ ] D1 从单 JSON 迁移到多表

---

## 十、与 Codex 版本的核心差异

| 维度 | Codex 版本 | 新方案 |
|------|-----------|--------|
| 前端结构 | 单文件 main.jsx | 30+ 组件按域分文件 |
| 状态管理 | 一个巨型 useState | Zustand 按域分 store |
| 数据库 | 单 JSON blob | 12 张关系表 |
| Agent 上下文 | 每次全量注入 | 4 级按需注入 |
| 爬虫 | CF Worker Cron | GitHub Actions + Node |
| 流式输出 | 可能有 | 原生 SSE，每个对话必须有 |
| 移动端 | 响应式 CSS | 底部导航，触摸优化 |
| 错误处理 | 最小化 | 重试逻辑 + 状态提示 |
| Dashboard | 模块按钮集合 | 优先级排序的今日清单 |

---

## 十一、技术选型确认

| 层 | 选型 | 理由 |
|----|------|------|
| 前端框架 | React 19 + Vite | 保持不变，生态熟悉 |
| 样式 | Tailwind CSS | 不再写自定义 CSS，一致性更强 |
| 状态 | Zustand | 比 Redux 轻，比 Context 强，适合这种规模 |
| 后端（本地） | Node.js + Hono | Express 可用，Hono 更轻、CF 兼容好 |
| 后端（线上） | Cloudflare Worker | 保持不变 |
| 数据库 | D1（多表） | 保持 CF 生态，但换正确用法 |
| 爬虫 | Node.js + GitHub Actions | 稳定、免费、不受 CF IP 限制 |
| AI | Anthropic API 直连 + OpenRouter 备用 | 保持不变 |
| 文件存储 | Cloudflare R2（Phase 4） | 取代当前 base64 塞 DB |
| 语音 | OpenAI Whisper | 保持不变 |

---

**这份方案解决了 Codex 版本的四个结构性问题，同时保留了你在文档中定义的全部业务逻辑。**

**请确认：觉得 OK 后我开始按 Phase 1 写代码。**
