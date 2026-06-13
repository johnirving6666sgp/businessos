# BusinessOS v2.0 启动指南

## 第一步：安装依赖

```bash
cd BusinessOS
npm install
```

## 第二步：配置环境变量

```bash
cp .env.example .env
```

编辑 `.env`，至少填入一个 LLM API Key：

```
ANTHROPIC_API_KEY=sk-ant-...
SESSION_SECRET=随便一串32位以上的字符串
```

## 第三步：初始化本地数据库

```bash
# 创建本地 D1（SQLite）并运行 migration
npm run db:migrate:local

# 写入初始用户（jamie/jamie-demo, larry/demo, 等）
npm run db:seed:local
```

## 第四步：本地启动

```bash
# 方式一：前端 + 本地 Node API（最快启动）
npm run dev

# 方式二：前端 + Cloudflare Worker 本地模拟（最接近线上）
npm run dev:cf &
npm run dev:ui
```

访问：http://localhost:5176

默认账号：
- jamie / jamie-demo（超管）
- larry / demo
- gu / demo

## 线上部署

```bash
# 1. 在 Cloudflare 创建 D1 数据库
npx wrangler d1 create business-os-db

# 2. 把 database_id 填入 wrangler.jsonc

# 3. 初始化远程数据库
npm run db:migrate:remote
npm run db:seed:remote

# 4. 配置 Secrets
npx wrangler secret put SESSION_SECRET
npx wrangler secret put ANTHROPIC_API_KEY
# （可选）
npx wrangler secret put OPENROUTER_API_KEY
npx wrangler secret put OPENAI_API_KEY
npx wrangler secret put CRAWLER_API_KEY

# 5. 部署
npm run deploy
```

## 常用命令

| 命令 | 用途 |
|------|------|
| `npm run dev` | 本地全栈启动 |
| `npm run dev:ui` | 仅前端（Vite） |
| `npm run dev:api` | 仅本地 API |
| `npm run build` | 构建前端 |
| `npm run deploy` | 部署到 Cloudflare |
| `npm run crawler:run` | 手动运行爬虫 |
