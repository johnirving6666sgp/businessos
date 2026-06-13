# EnterpriseOS 项目总文档

更新时间：2026-06-12

## 1. 项目定位

EnterpriseOS 是一个面向小团队试用的企业 Agent 工作台。当前目标不是一次性做成复杂 ERP/CRM，而是先把企业关键业务信息流串起来：

```text
外部线索
  -> 客户判断
  -> 任务跟进
  -> 方案/报价
  -> 内部复盘
  -> Agent 能力成长
```

系统价值起点是“帮助大家发现商机、抓住商机、实现商机”。因此当前 MVP 重点围绕三件事：

- 让每位同事有自己的个人助理 Agent，能记录真实工作信息。
- 让外部机会 Agent 稳定发现和整理招标/行业机会。
- 让任务、客户、方案工程和内部知识沉淀形成闭环。

系统目前运行形态：

- 本地开发：Vite 前端 `localhost:5176` + Node/Express API `localhost:8787`。
- 线上部署：Cloudflare Worker + D1 + 静态资源，域名 `timeconnector.net`。
- Render 作为历史部署尝试，当前优先使用 Cloudflare。

## 2. 当前团队与账号

当前默认同事：

| 同事 | 用户 ID | 默认密码 | 个人助理 | 当前定位 |
| --- | --- | --- | --- | --- |
| Jamie | `jamie` | `jamie-demo` | Jamie_AI | 系统负责人、Agent 成长和效率教练 |
| Larry | `larry` | `demo` | Larry_AI | 任务/方案流程负责人 |
| Gu | `gu` | `demo` | Gu_AI | 工艺与设备参数 |
| Xiaodong | `xiaodong` | `demo` | Xiaodong_AI | 项目协作 |
| Heli | `heli` | `demo` | Heli_AI | 运营支持 |
| Guihua | `guihua` | `demo` | Guihua_AI | 材料与供应 |
| Zhiping | `zhiping` | `demo` | Zhiping_AI | 设备选型 |
| Luyang | `luyang` | `demo` | Luyang_AI | 试用/测试、客户与项目协作 |
| Kingsong | `kingsong` | `demo` | Kingsong_AI | 试用/测试、设备与供应协作 |

说明：

- Jamie 是 `super_admin`。
- 普通同事只能进入自己的个人 Agent 工作空间。
- 同事离职时可以中止账号，并把对应 Agent 资产转交给接替人员。

## 3. 固定 Agent 分工

系统 Agent 固定为六类，原则是“一个 Agent 只负责一段业务流程”，避免职责混乱。

| Agent | 主要职责 | 不负责什么 |
| --- | --- | --- |
| 个人助理 Agent | 每位同事的私密工作助理，记录对话、上传资料、整理客户问题和下一步动作 | 不替代系统 Agent 管理组织流程 |
| 外部机会 Agent | 扫描招标、行业新闻、企业动态，整理外部机会进入线索池 | 不维护客户阶段、不生成报价、不分配任务 |
| 客户管理 Agent | 维护客户阶段、负责人、沟通记录、下一步跟进建议 | 不扫描外部网站、不生成报价金额 |
| 任务看板 Agent | 从对话、会议纪要、商机收藏、广播反馈、报价流程中提取任务并跟进 | 不维护完整客户漏斗、不生成方案工程 |
| 方案工程师 Agent | 生成技术方案、设备/服务配置、报价依据、缺失参数、风险点 | 不承诺正式对外报价，不替代人工工程评审 |
| 内部信息 Agent | 沉淀知识、经验、复盘和专家资产 | 不向普通同事暴露其他人的私密原文 |

## 4. 页面结构

### 4.1 业务工作台

登录后默认进入业务工作台。它应该回答一个问题：

```text
今天我应该先处理什么？
```

工作台展示：

- 重点线索
- 我的客户
- 待办任务
- 待处理方案/报价
- 内部广播/协作邀请
- 我的 Agent 对话入口
- Agent 成长提示

工作台不是模块按钮集合，而是日常工作入口。

### 4.2 我的 Agent

每位同事进入自己的私密对话空间。

能力：

- 文字输入
- 语音输入
- 文件/图片上传
- 对 Agent 回复进行反馈：有用、不准、需更具体
- 从回复中生成任务
- 把外部机会拉进对话进一步分析

关键逻辑：

- 新对话尽量少引入历史上下文，让模型充分发挥通用 AI 能力。
- 当对话开始指向客户、任务、方案或报价时，再逐步引入相关上下文。
- 根据用户意图决定是否拉入任务看板 Agent、客户管理 Agent 或方案工程师 Agent。

### 4.3 线索池

线索池承载外部机会 Agent 发现的招标、新闻和商机。

当前交互原则：

- 默认展示线索列表，卡片收起。
- 点击卡片区域展开详情。
- 详情在原卡片内展开，不跳到页面底部。
- 展开后提供：
  - 收起
  - 收藏
  - 拉进对话
  - 同事评分：0 / 30 / 60 / 80 / 100
- 相同内容要合并，避免重复刷屏。
- 线索多时分页展示。

评分含义：

| 分数 | 含义 |
| --- | --- |
| 0 | 完全无用 |
| 30 | 有点相关，但价值不大 |
| 60 | 比较有用，可关注 |
| 80 | 有明显价值，值得跟进 |
| 100 | 非常有用，优先推进 |

评分会反哺外部机会 Agent 的排序和筛选规则。

### 4.4 客户管理

客户管理采用阶段看板：

```text
未接触 -> 已接触 -> 有意向 -> 待报价 -> 待成交 -> 已成交/流失
```

客户卡片应包含：

- 客户名称
- 当前阶段
- 负责人
- 最近一次沟通
- 下一步任务
- 关联商机
- 关联方案/报价

语义规则示例：

- “找到了官网和联系方式，准备明天联系”应归为“未接触”，不是“已接触”。
- “已经和对方负责人沟通过需求”才进入“已接触”。

### 4.5 任务看板

任务看板 Agent 负责把信息变成可执行任务。

任务来源：

- 个人 Agent 对话
- 会议纪要
- 客户访谈
- 商机收藏
- 广播反馈
- 方案/报价流程

任务字段：

- 标题
- 负责人
- 截止时间
- 来源
- 关联客户
- 关联商机
- 关联方案/报价
- 状态
- 结果评估

状态：

```text
待办 -> 进行中 -> 等待反馈 -> 已完成 -> 已关闭
```

Larry 是任务看板 Agent 的日常负责人，但所有同事都有使用权限。

### 4.6 方案工程师

原“报价 Agent”已升级为“方案工程师 Agent”。

目标不是直接给一个价格，而是生成可信的方案工程和报价依据。

输出应覆盖：

- 报价对象
- 设备/服务范围
- 技术参数
- 成本构成
- 风险点
- 类似历史报价参考
- 市场价格参考
- 推荐报价区间
- 可谈判空间
- 需要人工确认的问题

已导入 `smtx-proposal-engineer` 的方案生成 Skill：

- Skill 源目录：`/Users/aijamie4bc/Desktop/smtx-proposal-engineer`
- 导入脚本：`scripts/import-agent-skill.mjs`
- 生成文件：`config/agent-skills/solution-generation.md`
- 运行时代码：`agent-skills.generated.mjs`

方案工程师 Agent 支持“直接训练”对话，但该能力受权限控制。

### 4.7 内部信息仓

内部信息 Agent 用于沉淀组织记忆：

- 从对话、任务、客户、方案、广播中抽象经验。
- 形成专家资产。
- 支持 Jamie 审查和发布。
- 不直接暴露其他同事私密原文。

## 5. 权限体系

权限字段：

| 字段 | 含义 |
| --- | --- |
| `agents` | 是否可使用个人 Agent |
| `customers` | 是否可看客户管理 |
| `quote` | 是否可使用方案工程师模块 |
| `tasks` | 是否可管理任务 |
| `quoteTraining` | 是否可直接训练方案工程师 Agent |
| `insight` | 是否可查看内部信息仓 |

关键规则：

- Jamie 默认拥有所有权限。
- 普通同事默认不拥有 `quoteTraining`。
- Jamie 可在 Jamie Central 中给 Larry、Gu、Kingsong 等指定人员开通方案工程师训练权限。
- `quoteTraining` 不只是前端显示控制，后端接口也会校验。
- 权限更新写入后端数据后即时生效；用户页面可能需要刷新以同步 UI 状态。

相关接口：

```text
PATCH /api/admin/users/:id/permissions
POST  /api/system-agents/:id/chat
```

其中 `/api/system-agents/quote/chat` 会校验 `quoteTraining`。

## 6. 模型路由

当前建议模型：

| 对象 | 模型 |
| --- | --- |
| Jamie / Larry / Gu / Xiaodong | Claude Opus 4.8 |
| Zhiping / Luyang / Kingsong | Claude Sonnet 4.6 |
| Heli / Guihua | Claude Haiku 4.5 |
| 外部机会 Agent | Claude Sonnet 4.6 |
| 方案工程师 Agent | Claude Sonnet 4.6 |

支持的平台：

- Claude 直连：`ANTHROPIC_API_KEY`
- OpenAI 直连：`OPENAI_API_KEY`
- OpenRouter：`OPENROUTER_API_KEY`
- OpenRouter 备用：`OPENROUTER_BACKUP_API_KEY`

语音转文字依赖：

- `OPENAI_API_KEY`
- 默认模型：`OPENAI_TRANSCRIPTION_MODEL=whisper-1`

## 7. 数据流

### 7.1 商机主流程

```text
外部机会 Agent 扫描招标/新闻
  -> 进入线索池
  -> 去重、补详情、按时间和相关性排序
  -> 同事点击、收藏、评分
  -> 收藏线索进入个人 Agent 对话
  -> 客户管理 Agent 创建/更新客户
  -> 任务看板 Agent 生成跟进任务
  -> 需要方案时调用方案工程师 Agent
  -> 方案结果进入客户、任务、知识库
  -> 内部信息 Agent 复盘成组织经验
```

### 7.2 个人对话主流程

```text
同事输入现场信息/会议纪要/客户问题
  -> 个人助理 Agent 判断是否新对话
  -> 新对话：少引入上下文，优先给高质量通用回答
  -> 非新对话：按客户/任务/报价/经验逐步引入上下文
  -> 根据下一步动作调用对应系统 Agent
```

### 7.3 广播协作流程

```text
Jamie 或系统 Agent 创建广播
  -> 指定一个或多个同事
  -> 同事反馈：收到 / 跟进中 / 需要讨论
  -> 如果需要讨论，指定讨论对象
  -> 系统生成协作任务或后续提醒
```

## 8. 外部机会 Agent 与招标抓取

当前重点来源：

1. 中国招标投标公共服务平台  
   `https://ctbpsp.com/#/bulletinList`

2. 全国招标采购信息平台  
   `https://zb.yfb.qianlima.com/yfbsemsite/mesinfo/zbpglist`

关键词方向：

- 熔炼
- 熔炼炉
- 真空熔炼
- 悬浮熔炼
- 悬浮真空感应熔炼
- 冷坩埚
- 高温难熔金属
- 高熵合金
- 靶材
- 金属材料
- 新材料

相关脚本：

| 命令 | 用途 |
| --- | --- |
| `npm run crawl:tenders` | 抓招标列表 |
| `npm run crawl:tender-details` | 抓详情页正文并补字段 |
| `npm run crawl:tender-sync` | 一键抓取并同步到系统 |
| `npm run import:ctbpsp` | 导入中国招标投标公共服务平台快照 |
| `npm run mine:opportunities` | 从抓取数据中挖掘机会 |
| `npm run cleanup:opportunities` | 清理重复或无效线索 |

线上 Worker 已配置 Cron：

```text
0 23 * * sun  # 香港时间周一 07:00
0 23 * * thu  # 香港时间周五 07:00
```

注意：

- Cloudflare Worker 适合轻量巡检，不适合作为唯一稳定爬虫。
- 国内招标网站可能限制 Cloudflare 边缘节点，出现 403、405、500、验证码、JS 渲染等问题。
- 稳定方案是把 Node 爬虫部署到 Mac mini、GitHub Actions、Render Cron 或其他定时环境，再回写系统。
- 如果被封，应保留“待人工核验”卡片，不把未验证结果当成真实机会。

## 9. 技术架构

### 9.1 前端

目录：

```text
src/main.jsx
src/styles.css
```

技术：

- React 19
- Vite
- lucide-react 图标
- 单页应用
- 移动端优先适配

主要状态：

- 当前页面
- 当前登录用户
- 个人对话
- 系统 Agent 输出
- 商机线索
- 客户
- 任务
- 方案/报价
- 广播
- 权限
- 模型路由
- Agent 成长状态

### 9.2 本地后端

目录：

```text
server/index.mjs
server/tender-scanner.mjs
data/store.json
```

能力：

- 登录/注册
- 状态读取
- 个人 Agent 聊天
- 系统 Agent 运行
- 方案工程师训练对话
- 任务、客户、商机、广播、权限管理
- 文件/PDF 读取
- 语音转文字
- Obsidian Markdown 同步

### 9.3 线上后端

目录：

```text
worker/index.mjs
wrangler.jsonc
migrations/0001_app_state.sql
```

Cloudflare 结构：

```text
timeconnector.net
  -> Cloudflare Worker enterprise-os
     -> ASSETS 静态资源 ./dist
     -> /api/* 走 Worker API
     -> D1: enterprise-os-db
     -> Secrets: SESSION_SECRET / OPENROUTER_API_KEY / OPENAI_API_KEY / ANTHROPIC_API_KEY
```

当前 D1 数据模型：

- 表：`app_state`
- 存储：整体 JSON 状态

这是试用阶段最低风险方案。正式化后应拆成多张表：

- users
- agents
- conversations
- opportunities
- customers
- tasks
- quotes
- broadcasts
- audit_logs

## 10. 关键 API

### 登录注册

```text
POST /api/login
POST /api/register
GET  /api/state
```

### 个人 Agent

```text
POST /api/agents/:id/chat
POST /api/agents/:id/conversation/clear
POST /api/agents/:id/route
POST /api/agents/:id/suspend
POST /api/agents/:id/transfer
```

### 系统 Agent

```text
POST /api/system-agents/:id/run
POST /api/system-agents/:id/route
POST /api/system-agents/quote/chat
```

### 商机

```text
POST /api/opportunities/:id/save
POST /api/opportunities/:id/feedback
POST /api/opportunities/details
POST /api/opportunities/cleanup
```

### 任务、广播、反馈

```text
POST  /api/tasks
POST  /api/tasks/from-message
PATCH /api/tasks/:id
POST  /api/broadcasts
POST  /api/broadcasts/:id/feedback
POST  /api/agent-feedback
```

### 模型和语音

```text
POST /api/llm/proxy
POST /api/speech/transcribe
GET  /api/admin/model-health
```

### 权限

```text
PATCH /api/admin/users/:id/permissions
```

## 11. 本地开发

安装：

```bash
npm install
```

启动前端：

```bash
npm run dev
```

启动本地 API：

```bash
npm run dev:api
```

访问：

```text
http://localhost:5176
```

如果页面提示 API 失败，检查：

```text
http://localhost:8787/api/health
```

构建：

```bash
npm run build
```

Cloudflare 本地预览：

```bash
npm run dev:cf
```

## 12. 线上部署

构建并 dry-run：

```bash
npm run build:cf
```

部署：

```bash
npm run deploy:cf
```

线上健康检查：

```bash
curl https://timeconnector.net/api/health
```

预期：

```json
{"ok":true,"app":"EnterpriseOS","runtime":"cloudflare-worker","storage":"d1"}
```

必需 Secrets：

```bash
npx wrangler secret put SESSION_SECRET
npx wrangler secret put OPENAI_API_KEY
npx wrangler secret put ANTHROPIC_API_KEY
npx wrangler secret put OPENROUTER_API_KEY
npx wrangler secret put OPENROUTER_BACKUP_API_KEY
```

最低可运行：

- `SESSION_SECRET`
- 至少一个模型 key

语音可用还需要：

- `OPENAI_API_KEY`

## 13. Obsidian 知识沉淀

系统保留 Obsidian 同步能力：

```text
POST /api/obsidian/sync
```

本地输出目录：

```text
vault/
```

用途：

- conversations：对话摘要
- agents：Agent 注册和配置
- insights：内部信息 Agent 提炼结果
- audit：关键操作记录

当前建议：

- Obsidian 作为知识沉淀副本，不作为主数据库。
- 主业务数据仍由系统数据库保存。
- 复盘、专家资产、方案模板可以沉淀到 Obsidian。

## 14. Agent 成长机制

每个个人助理有成长等级，从初级到五星，共 10 档：

```text
初级
半星
一星
一星半
二星
二星半
三星
三星半
四星
五星
```

成长来源：

- 用户持续输入真实工作信息
- 用户对回复点“有用/不准/需更具体”
- 生成任务
- 关联客户
- 收藏商机
- 形成方案/报价
- 内部信息 Agent 沉淀复盘

Jamie_AI 的定位：

- 评估各 Agent 是否真正帮到人。
- 找出回答空泛、不准、没有下一步动作的 Agent。
- 检查业务流是否闭环。
- 推动个人助理、任务 Agent、客户 Agent、方案工程师 Agent 变得更好。

## 15. 当前已解决的问题

已经完成的关键改进：

- 企业OS 与其他项目区分为独立项目。
- 增加登录/注册/审批。
- 支持 Jamie、Larry、Gu、Xiaodong、Heli、Guihua、Zhiping、Luyang、Kingsong。
- 支持个人 Agent 私密空间。
- 支持文字、语音、文件/图片上传。
- 支持大模型平台路由：Claude / OpenAI / OpenRouter。
- 支持任务看板 Agent、客户管理 Agent、外部机会 Agent、内部信息 Agent、方案工程师 Agent。
- 支持外部机会线索池、展开详情、评分、收藏、拉进对话。
- 支持招标网站抓取和详情爬虫。
- 支持方案工程师 Skill 导入。
- 支持方案工程师训练权限单独配置。
- 支持 Cloudflare Worker + D1 部署。
- 支持 `timeconnector.net` 访问。

## 16. 当前主要风险

### 16.1 外部招标数据稳定性

这是系统价值起点，也是最大风险。

风险：

- 招标网站反爬。
- 页面结构变化。
- Cloudflare 边缘节点访问被限制。
- 详情页需要 JS 渲染或验证码。

建议：

- 用独立 Node 爬虫做稳定抓取。
- Worker 只做展示、轻量巡检和调度提示。
- 给每条线索保留来源 URL、抓取时间、详情完整度、待补字段。
- 对“待人工核验”线索明确标识。

### 16.2 Agent 回答质量

之前的问题是个人助理回答不如普通 AI，原因包括：

- 过早强行套业务流程。
- 上下文引入过多。
- 对普通问题没有先给高质量直接回答。
- 系统为了闭环而打断对话自然性。

当前改进方向：

- 新对话先按通用大模型能力回答。
- 只有当用户明确进入客户、任务、报价、商机、经验沉淀时，才引入业务上下文和系统 Agent。
- 回复要先解决问题，再提示可选下一步。

### 16.3 数据模型

当前 D1 使用整包 JSON 存储，适合试用，不适合长期高并发。

正式化需要拆表。

### 16.4 权限和审计

当前权限已能覆盖试用，但后续要增强：

- 权限变更审计
- 角色模板
- 操作日志检索
- 训练权限有效期
- 敏感数据访问记录

## 17. 下一阶段建议

优先级按价值排序：

### P0：商机挖掘稳定化

- 把两个招标网站抓取做成稳定定时服务。
- 详情页正文、招标单位、预算、截止时间、联系人尽量补齐。
- 相同招标合并。
- 线索按最近 30/90/180 天分层。
- 同事评分反哺排序。

### P0：个人助理回答质量

- 优化个人助理 prompt。
- 新对话减少上下文污染。
- 拉入系统 Agent 前先解决用户问题。
- 长回答不要截断，需要支持完整输出。

### P1：方案工程师专业化

- 继续训练方案工程师 Agent。
- 把历史方案、设备参数、服务边界、报价模板纳入知识库。
- 对不同设备类型形成方案模板。

### P1：客户和任务闭环

- 客户阶段判断更准确。
- 每个任务必须有来源和结果评估。
- 任务完成后触发复盘。

### P2：数据结构正式化

- D1 拆表。
- 文件存储接 R2。
- 向量检索接 Vectorize 或其他向量库。
- 对话和知识沉淀分层存储。

### P2：移动端体验

- 继续优化类似微信的对话体验。
- 语音录音状态不遮挡按钮。
- 保证进入对话后默认滚动到最后一条。
- 长文回复阅读体验优化。

## 18. 常用命令

```bash
# 本地前端
npm run dev

# 本地 API
npm run dev:api

# Cloudflare 本地
npm run dev:cf

# 构建
npm run build

# Cloudflare dry-run
npm run build:cf

# 部署 Cloudflare
npm run deploy:cf

# 抓招标列表
npm run crawl:tenders

# 抓招标详情
npm run crawl:tender-details

# 抓取并同步线上
ENTERPRISE_OS_PASSWORD=jamie-demo npm run crawl:tender-sync -- --sync-api=https://timeconnector.net --user=jamie

# 导入方案工程师 Skill
npm run import:solution-skill
```

## 19. 交接注意事项

后续开发接手时，优先看这些文件：

```text
src/main.jsx
src/styles.css
server/index.mjs
server/tender-scanner.mjs
worker/index.mjs
scripts/sync-tender-opportunities.mjs
scripts/crawl-tender-details.mjs
config/tender-sources.json
wrangler.jsonc
```

不要直接改动的内容：

- 不要把 API Key 写入代码或文档。
- 不要把 `data/store.json` 当成正式线上数据来源。
- 不要让普通同事看到其他同事原始私密对话。
- 不要让外部机会 Agent 同时承担客户、任务、报价职责。

工程原则：

- 先保证商机线索真实、完整、可追溯。
- 再保证同事能快速判断和跟进。
- 最后让任务、客户、方案和复盘自然闭环。

