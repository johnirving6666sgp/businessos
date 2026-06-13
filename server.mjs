/**
 * 本地开发服务器
 * 使用 @hono/node-server + better-sqlite3 模拟 Cloudflare D1
 *
 * 运行：node --env-file=.env server.mjs
 */

import { serve } from '@hono/node-server'
import Database from 'better-sqlite3'
import { readFileSync, existsSync, mkdirSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import app from './worker/index.mjs'

const __dir = dirname(fileURLToPath(import.meta.url))
const DATA_DIR = resolve(__dir, '.data')
const DB_PATH = resolve(DATA_DIR, 'local.db')
const MIGRATION = resolve(__dir, 'migrations/0001_init.sql')
const PORT = parseInt(process.env.API_PORT || '8787')

// ── 本地 SQLite D1 适配器 ─────────────────────────────────────

if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true })

const sqlite = new Database(DB_PATH)
sqlite.pragma('journal_mode = WAL')
sqlite.pragma('foreign_keys = ON')

// 运行 migration（幂等）
if (existsSync(MIGRATION)) {
  const sql = readFileSync(MIGRATION, 'utf-8')
  sqlite.exec(sql)
}

/**
 * D1 兼容层：把 better-sqlite3 的同步接口包成 D1 的异步 promise 接口
 */
function makeD1Compat(db) {
  function wrapResult(stmt, args = []) {
    const bound = stmt.bind ? stmt : db.prepare(stmt)
    return {
      first: () => Promise.resolve(bound.get(...args) || null),
      all: () => Promise.resolve({ results: bound.all(...args) }),
      run: () => Promise.resolve(bound.run(...args)),
    }
  }

  return {
    prepare(sql) {
      const stmt = db.prepare(sql)
      const boundArgs = []
      return {
        bind(...args) {
          // better-sqlite3 使用位置参数
          const boundStmt = db.prepare(sql)
          return {
            first: () => Promise.resolve(boundStmt.get(...args) || null),
            all: () => Promise.resolve({ results: boundStmt.all(...args) }),
            run: () => Promise.resolve(boundStmt.run(...args)),
          }
        },
        first: () => Promise.resolve(stmt.get() || null),
        all: () => Promise.resolve({ results: stmt.all() }),
        run: () => Promise.resolve(stmt.run()),
      }
    },
    exec(sql) {
      return Promise.resolve(db.exec(sql))
    },
  }
}

// ── 本地 env（模拟 CF Worker bindings）───────────────────────

const localEnv = {
  DB: makeD1Compat(sqlite),
  ASSETS: null,
  SESSION_SECRET: process.env.SESSION_SECRET || 'local-dev-secret-change-in-production',
  ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
  OPENAI_API_KEY: process.env.OPENAI_API_KEY,
  OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY,
  OPENROUTER_BACKUP_API_KEY: process.env.OPENROUTER_BACKUP_API_KEY,
  CRAWLER_API_KEY: process.env.CRAWLER_API_KEY,
  APP_NAME: 'BusinessOS',
  APP_VERSION: '2.0.0',
}

// ── 启动服务器 ────────────────────────────────────────────────

serve({
  fetch: (req) => app.fetch(req, localEnv),
  port: PORT,
}, (info) => {
  console.log(`\n🚀 BusinessOS API running at http://localhost:${info.port}`)
  console.log(`   DB: ${DB_PATH}`)
  if (!process.env.ANTHROPIC_API_KEY && !process.env.OPENROUTER_API_KEY) {
    console.warn('   ⚠️  No LLM API key found. Chat will not work.')
  }
  console.log()
})

// 优雅退出
process.on('SIGTERM', () => { sqlite.close(); process.exit(0) })
process.on('SIGINT', () => { sqlite.close(); process.exit(0) })
