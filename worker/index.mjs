/**
 * BusinessOS v2.0 - Cloudflare Worker 入口
 * 使用 Hono 框架
 */

import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import auth from './routes/auth.mjs'
import conversations from './routes/conversations.mjs'
import opportunities from './routes/opportunities.mjs'
import customers from './routes/customers.mjs'
import tasks from './routes/tasks.mjs'
import broadcasts from './routes/broadcasts.mjs'
import proposals from './routes/proposals.mjs'
import knowledge from './routes/knowledge.mjs'

const app = new Hono()

// ── 中间件 ────────────────────────────────────────────────────
app.use('*', logger())

app.use('/api/*', cors({
  origin: ['http://localhost:5176', 'http://localhost:8787', 'https://timeconnector.net'],
  allowMethods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization', 'Cookie'],
  credentials: true,
}))

// ── API 路由 ──────────────────────────────────────────────────
app.route('/api/auth', auth)
app.route('/api/conversations', conversations)
app.route('/api/opportunities', opportunities)
app.route('/api/customers', customers)
app.route('/api/tasks', tasks)
app.route('/api/broadcasts', broadcasts)
app.route('/api/proposals', proposals)
app.route('/api/knowledge', knowledge)

// 健康检查
app.get('/api/health', (c) => c.json({
  ok: true,
  app: 'BusinessOS',
  version: '2.0.0',
  runtime: typeof EdgeRuntime !== 'undefined' ? 'cloudflare-worker' : 'node',
  ts: new Date().toISOString(),
}))

// ── 静态资源（CF Assets binding）────────────────────────────
app.get('*', async (c) => {
  // 所有非 /api 路由返回 index.html（SPA 路由）
  if (c.env.ASSETS) {
    try {
      const url = new URL(c.req.url)
      // 先尝试精确匹配静态资源
      const assetRes = await c.env.ASSETS.fetch(c.req.raw)
      if (assetRes.status !== 404) return assetRes
      // 其他路由返回 index.html
      const indexUrl = new URL('/index.html', url.origin)
      return c.env.ASSETS.fetch(new Request(indexUrl.toString()))
    } catch {
      return c.notFound()
    }
  }
  return c.text('BusinessOS API is running. Start the frontend with: npm run dev:ui', 200)
})

export default app
