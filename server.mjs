/**
 * 本地开发服务器
 * 使用 @hono/node-server + better-sqlite3 模拟 Cloudflare D1
 *
 * 运行：node --env-file=.env server.mjs
 */

import { serve } from '@hono/node-server'
import Database from 'better-sqlite3'
import { readFileSync, existsSync, mkdirSync, readdirSync } from 'fs'
import { resolve, dirname, join } from 'path'
import { fileURLToPath } from 'url'
import app from './worker/index.mjs'

const __dir = dirname(fileURLToPath(import.meta.url))
const DATA_DIR = resolve(__dir, '.data')
const DB_PATH = resolve(DATA_DIR, 'local.db')
const MIGRATIONS_DIR = resolve(__dir, 'migrations')
const PORT = parseInt(process.env.API_PORT || '8787')

// ── 本地 SQLite D1 适配器 ─────────────────────────────────────

if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true })

const sqlite = new Database(DB_PATH)
sqlite.pragma('journal_mode = WAL')
sqlite.pragma('foreign_keys = ON')

// 按文件名顺序运行全部 migration，每个文件只执行一次（用 _migrations 表追踪）。
// 这样本地 schema 与生产保持一致，且 ALTER TABLE 不会因重复执行而报错。
function runMigrations(db, dir) {
  db.exec(`CREATE TABLE IF NOT EXISTS _migrations (
    name TEXT PRIMARY KEY,
    applied_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`)
  const applied = new Set(db.prepare('SELECT name FROM _migrations').all().map(r => r.name))
  const files = readdirSync(dir).filter(f => f.endsWith('.sql')).sort()

  for (const file of files) {
    if (applied.has(file)) continue
    const sql = readFileSync(join(dir, file), 'utf-8')
    try {
      db.exec(sql)
      db.prepare('INSERT INTO _migrations (name) VALUES (?)').run(file)
      console.log(`   ✅ migration: ${file}`)
    } catch (err) {
      console.error(`   ❌ migration ${file} 失败: ${err.message}`)
      throw err
    }
  }
}

runMigrations(sqlite, MIGRATIONS_DIR)

/**
 * D1 兼容层：把 better-sqlite3 的同步接口包成 D1 的异步 promise 接口
 */
function makeD1Compat(db) {
  // 把 better-sqlite3 的 run() 结果包装成 D1 的形状，
  // 让 result.meta.last_row_id / result.meta.changes 在本地也能用。
  const wrapRun = (r) => ({
    success: true,
    meta: { last_row_id: r.lastInsertRowid, changes: r.changes },
    results: [],
  })

  return {
    prepare(sql) {
      const stmt = db.prepare(sql)
      return {
        bind(...args) {
          return {
            first: () => Promise.resolve(stmt.get(...args) || null),
            all: () => Promise.resolve({ results: stmt.all(...args) }),
            run: () => Promise.resolve(wrapRun(stmt.run(...args))),
          }
        },
        first: () => Promise.resolve(stmt.get() || null),
        all: () => Promise.resolve({ results: stmt.all() }),
        run: () => Promise.resolve(wrapRun(stmt.run())),
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
  ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
  OPENAI_API_KEY: process.env.OPENAI_API_KEY,
  OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY,
  OPENROUTER_BACKUP_API_KEY: process.env.OPENROUTER_BACKUP_API_KEY,
  CRAWLER_SECRET: process.env.CRAWLER_SECRET || process.env.CRAWLER_API_KEY,
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
